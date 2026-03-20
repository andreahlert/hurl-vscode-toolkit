import * as vscode from "vscode";
import { HTTP_METHODS } from "../data/methods";
import { COMMON_HEADERS } from "../data/headers";
import { STATUS_CODES } from "../data/statusCodes";
import { SECTIONS } from "../data/sections";
import { ASSERT_PREDICATES, FILTER_FUNCTIONS } from "../data/asserts";
import { OPTIONS } from "../data/options";
import { getContextAtPosition } from "../utils/hurlParser";

export class HurlCompletionProvider implements vscode.CompletionItemProvider {
  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken,
    _context: vscode.CompletionContext
  ): vscode.CompletionItem[] {
    const ctx = getContextAtPosition(document, position);
    const lineText = ctx.lineText;
    const textBeforeCursor = lineText.substring(0, position.character);
    const items: vscode.CompletionItem[] = [];

    // Variable completions anywhere: {{
    if (textBeforeCursor.endsWith("{{") || textBeforeCursor.match(/\{\{[\w]*$/)) {
      return this.getVariableCompletions(document);
    }

    // HTTP methods at the start of a line
    if (ctx.context === "method-line" || textBeforeCursor.trim() === "" || textBeforeCursor.match(/^\s*[A-Z]*$/)) {
      if (lineText.trim() === "" || textBeforeCursor.match(/^\s*[A-Z]*$/)) {
        items.push(...this.getMethodCompletions());
      }
    }

    // HTTP status codes after "HTTP "
    if (textBeforeCursor.match(/^\s*HTTP\s+\d*$/)) {
      items.push(...this.getStatusCodeCompletions());
      return items;
    }

    // Section names when typing "["
    if (textBeforeCursor.match(/^\s*\[[\w]*$/)) {
      items.push(...this.getSectionCompletions());
      return items;
    }

    // Headers after method line (in request context before HTTP status)
    if (ctx.context === "request-header" && textBeforeCursor.match(/^\s*[\w-]*$/)) {
      items.push(...this.getHeaderCompletions());
    }

    // Header values after ":"
    const headerValueMatch = textBeforeCursor.match(/^\s*([\w-]+)\s*:\s*(.*)$/);
    if (headerValueMatch) {
      const headerName = headerValueMatch[1];
      items.push(...this.getHeaderValueCompletions(headerName));
      return items;
    }

    // Options inside [Options] section
    if (ctx.currentSection === "Options") {
      items.push(...this.getOptionCompletions());
      return items;
    }

    // Assert predicates inside [Asserts] section
    if (ctx.currentSection === "Asserts") {
      items.push(...this.getAssertCompletions(textBeforeCursor));
      return items;
    }

    // Capture queries inside [Captures] section
    if (ctx.currentSection === "Captures") {
      if (textBeforeCursor.match(/:\s*$/)) {
        items.push(...this.getCaptureQueryCompletions());
      }
      return items;
    }

    return items;
  }

  private getMethodCompletions(): vscode.CompletionItem[] {
    return HTTP_METHODS.map((method) => {
      const item = new vscode.CompletionItem(
        method.name,
        vscode.CompletionItemKind.Keyword
      );
      item.detail = method.description;
      item.insertText = new vscode.SnippetString(
        `${method.name} \${1:http://localhost:8080/api/}\${0}`
      );
      item.sortText = `0-${method.name}`;
      return item;
    });
  }

  private getStatusCodeCompletions(): vscode.CompletionItem[] {
    return STATUS_CODES.map((sc) => {
      const item = new vscode.CompletionItem(
        `${sc.code}`,
        vscode.CompletionItemKind.EnumMember
      );
      item.detail = `${sc.code} ${sc.phrase}`;
      item.documentation = sc.description;
      item.insertText = `${sc.code}`;
      item.filterText = `${sc.code} ${sc.phrase}`;
      return item;
    });
  }

  private getSectionCompletions(): vscode.CompletionItem[] {
    return SECTIONS.map((section) => {
      const item = new vscode.CompletionItem(
        `[${section.name}]`,
        vscode.CompletionItemKind.Module
      );
      item.detail = `${section.context} section`;
      item.documentation = section.description;
      item.insertText = new vscode.SnippetString(`[${section.name}]\n\${0}`);
      item.filterText = `[${section.name}]`;
      return item;
    });
  }

  private getHeaderCompletions(): vscode.CompletionItem[] {
    return COMMON_HEADERS.map((header) => {
      const item = new vscode.CompletionItem(
        header.name,
        vscode.CompletionItemKind.Field
      );
      item.detail = header.description;
      if (header.values && header.values.length > 0) {
        item.insertText = new vscode.SnippetString(
          `${header.name}: \${1|${header.values.join(",")}|}\${0}`
        );
      } else {
        item.insertText = new vscode.SnippetString(
          `${header.name}: \${1}\${0}`
        );
      }
      return item;
    });
  }

  private getHeaderValueCompletions(headerName: string): vscode.CompletionItem[] {
    const header = COMMON_HEADERS.find(
      (h) => h.name.toLowerCase() === headerName.toLowerCase()
    );
    if (!header?.values) return [];

    return header.values.map((value) => {
      const item = new vscode.CompletionItem(
        value,
        vscode.CompletionItemKind.Value
      );
      item.insertText = value;
      return item;
    });
  }

  private getOptionCompletions(): vscode.CompletionItem[] {
    return OPTIONS.map((opt) => {
      const item = new vscode.CompletionItem(
        opt.name,
        vscode.CompletionItemKind.Property
      );
      item.detail = opt.description;
      if (opt.valueType === "boolean") {
        item.insertText = new vscode.SnippetString(
          `${opt.name}: \${1|true,false|}\${0}`
        );
      } else if (opt.valueType === "integer") {
        item.insertText = new vscode.SnippetString(
          `${opt.name}: \${1:0}\${0}`
        );
      } else if (opt.valueType === "string") {
        item.insertText = new vscode.SnippetString(
          `${opt.name}: \${1}\${0}`
        );
      } else {
        item.insertText = `${opt.name}`;
      }
      return item;
    });
  }

  private getAssertCompletions(textBeforeCursor: string): vscode.CompletionItem[] {
    const items: vscode.CompletionItem[] = [];

    // If at the start of a line, suggest query types
    if (textBeforeCursor.match(/^\s*$/)) {
      const queryTypes = [
        { name: "status", snippet: "status $0", detail: "Assert the HTTP status code" },
        { name: "header", snippet: 'header "${1:Content-Type}" ${0}', detail: "Assert a response header value" },
        { name: "jsonpath", snippet: 'jsonpath "${1:\\$.}" ${0}', detail: "Assert a JSONPath expression result" },
        { name: "xpath", snippet: 'xpath "${1}" ${0}', detail: "Assert an XPath expression result" },
        { name: "body", snippet: "body ${0}", detail: "Assert the response body" },
        { name: "bytes", snippet: "bytes ${0}", detail: "Assert the raw response bytes" },
        { name: "cookie", snippet: 'cookie "${1:name}" ${0}', detail: "Assert a response cookie value" },
        { name: "url", snippet: "url ${0}", detail: "Assert the effective URL after redirects" },
        { name: "regex", snippet: 'regex "${1}" ${0}', detail: "Assert a regex match on the body" },
        { name: "sha256", snippet: "sha256 ${0}", detail: "Assert the SHA-256 hash of the body" },
        { name: "md5", snippet: "md5 ${0}", detail: "Assert the MD5 hash of the body" },
        { name: "duration", snippet: "duration ${0}", detail: "Assert the response duration in ms" },
        { name: "certificate", snippet: 'certificate "${1:Subject}" ${0}', detail: "Assert a TLS certificate field" },
      ];

      for (const qt of queryTypes) {
        const item = new vscode.CompletionItem(qt.name, vscode.CompletionItemKind.Function);
        item.detail = qt.detail;
        item.insertText = new vscode.SnippetString(qt.snippet);
        items.push(item);
      }
    }

    // Suggest predicates after a query
    if (textBeforeCursor.match(/\S+\s+(".*?"\s*)?$/)) {
      for (const pred of ASSERT_PREDICATES) {
        const item = new vscode.CompletionItem(pred.name, vscode.CompletionItemKind.Operator);
        item.detail = pred.description;
        item.documentation = `Example: ${pred.example}`;
        item.insertText = pred.name;
        items.push(item);
      }

      for (const filter of FILTER_FUNCTIONS) {
        const item = new vscode.CompletionItem(filter.name, vscode.CompletionItemKind.Function);
        item.detail = filter.description;
        item.documentation = `Example: ${filter.example}`;
        item.insertText = filter.name;
        items.push(item);
      }
    }

    return items;
  }

  private getCaptureQueryCompletions(): vscode.CompletionItem[] {
    const queryTypes = [
      { name: "jsonpath", snippet: 'jsonpath "${1:\\$.}"', detail: "Capture a value using JSONPath" },
      { name: "xpath", snippet: 'xpath "${1}"', detail: "Capture a value using XPath" },
      { name: "header", snippet: 'header "${1}"', detail: "Capture a response header value" },
      { name: "cookie", snippet: 'cookie "${1}"', detail: "Capture a cookie value" },
      { name: "body", snippet: "body", detail: "Capture the entire response body" },
      { name: "bytes", snippet: "bytes", detail: "Capture the raw response bytes" },
      { name: "regex", snippet: 'regex "${1}"', detail: "Capture a regex match from the body" },
      { name: "url", snippet: "url", detail: "Capture the effective URL" },
      { name: "status", snippet: "status", detail: "Capture the status code" },
      { name: "duration", snippet: "duration", detail: "Capture the response duration" },
    ];

    return queryTypes.map((qt) => {
      const item = new vscode.CompletionItem(qt.name, vscode.CompletionItemKind.Function);
      item.detail = qt.detail;
      item.insertText = new vscode.SnippetString(qt.snippet);
      return item;
    });
  }

  private getVariableCompletions(document: vscode.TextDocument): vscode.CompletionItem[] {
    const variables = new Set<string>();
    const text = document.getText();

    // Find all captured variables (name: query)
    const captureRegex = /^\s*(\w+)\s*:\s*(?:jsonpath|xpath|header|cookie|body|regex|status|url|duration)\s/gm;
    let match: RegExpExecArray | null;
    while ((match = captureRegex.exec(text)) !== null) {
      variables.add(match[1]);
    }

    // Find all variable usages {{name}}
    const varRegex = /\{\{(\w+)\}\}/g;
    while ((match = varRegex.exec(text)) !== null) {
      variables.add(match[1]);
    }

    return Array.from(variables).map((v) => {
      const item = new vscode.CompletionItem(v, vscode.CompletionItemKind.Variable);
      item.detail = "Hurl variable";
      item.insertText = `${v}}}`;
      return item;
    });
  }
}

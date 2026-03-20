import * as vscode from "vscode";
import { METHOD_NAMES } from "../data/methods";
import { SECTION_NAMES } from "../data/sections";

const VALID_STATUS_RANGE_MIN = 100;
const VALID_STATUS_RANGE_MAX = 599;

export class HurlDiagnosticProvider {
  private diagnosticCollection: vscode.DiagnosticCollection;

  constructor(diagnosticCollection: vscode.DiagnosticCollection) {
    this.diagnosticCollection = diagnosticCollection;
  }

  public updateDiagnostics(document: vscode.TextDocument): void {
    if (document.languageId !== "hurl") {
      return;
    }

    const diagnostics: vscode.Diagnostic[] = [];

    for (let i = 0; i < document.lineCount; i++) {
      const line = document.lineAt(i);
      const text = line.text;
      const trimmed = text.trimStart();

      // Skip empty lines and comments
      if (trimmed === "" || trimmed.startsWith("#")) {
        continue;
      }

      // Check for invalid HTTP methods (lines that look like method lines but have invalid methods)
      const methodMatch = trimmed.match(/^([A-Z]{2,10})\s+(https?:\/\/|{{)/);
      if (methodMatch) {
        const method = methodMatch[1];
        if (!METHOD_NAMES.includes(method)) {
          const startIdx = text.indexOf(method);
          diagnostics.push(
            new vscode.Diagnostic(
              new vscode.Range(i, startIdx, i, startIdx + method.length),
              `Unknown HTTP method: ${method}. Valid methods: ${METHOD_NAMES.join(", ")}`,
              vscode.DiagnosticSeverity.Error
            )
          );
        }
      }

      // Check for malformed URLs on method lines
      const urlMatch = trimmed.match(/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|CONNECT|TRACE)\s+(.+)$/);
      if (urlMatch) {
        const url = urlMatch[2].trim();
        // URL should start with http://, https://, or a variable {{
        if (!url.match(/^(https?:\/\/|{{)/)) {
          const urlStart = text.indexOf(url);
          diagnostics.push(
            new vscode.Diagnostic(
              new vscode.Range(i, urlStart, i, urlStart + url.length),
              "URL should start with http://, https://, or a variable reference {{...}}",
              vscode.DiagnosticSeverity.Warning
            )
          );
        }
      }

      // Check for unknown section names
      const sectionMatch = trimmed.match(/^\[(\w+)\]/);
      if (sectionMatch) {
        const sectionName = sectionMatch[1];
        if (!SECTION_NAMES.includes(sectionName)) {
          const startIdx = text.indexOf(`[${sectionName}]`);
          diagnostics.push(
            new vscode.Diagnostic(
              new vscode.Range(i, startIdx, i, startIdx + sectionName.length + 2),
              `Unknown section: [${sectionName}]. Valid sections: ${SECTION_NAMES.join(", ")}`,
              vscode.DiagnosticSeverity.Error
            )
          );
        }
      }

      // Check for invalid status codes
      const statusMatch = trimmed.match(/^HTTP\s+(\d+)/);
      if (statusMatch) {
        const code = parseInt(statusMatch[1]);
        if (code < VALID_STATUS_RANGE_MIN || code > VALID_STATUS_RANGE_MAX) {
          const codeStr = statusMatch[1];
          const startIdx = text.indexOf(codeStr, text.indexOf("HTTP"));
          diagnostics.push(
            new vscode.Diagnostic(
              new vscode.Range(i, startIdx, i, startIdx + codeStr.length),
              `Invalid HTTP status code: ${code}. Status codes must be between ${VALID_STATUS_RANGE_MIN} and ${VALID_STATUS_RANGE_MAX}.`,
              vscode.DiagnosticSeverity.Error
            )
          );
        }
      }

      // Check for unclosed variables {{ without }}
      let varSearchStart = 0;
      while (true) {
        const openIdx = text.indexOf("{{", varSearchStart);
        if (openIdx === -1) break;
        const closeIdx = text.indexOf("}}", openIdx + 2);
        if (closeIdx === -1) {
          diagnostics.push(
            new vscode.Diagnostic(
              new vscode.Range(i, openIdx, i, text.length),
              "Unclosed variable reference. Expected closing }}.",
              vscode.DiagnosticSeverity.Error
            )
          );
          break;
        }
        varSearchStart = closeIdx + 2;
      }
    }

    this.diagnosticCollection.set(document.uri, diagnostics);
  }

  public dispose(): void {
    this.diagnosticCollection.dispose();
  }
}

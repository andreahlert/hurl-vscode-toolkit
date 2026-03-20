import * as vscode from "vscode";
import { HTTP_METHODS } from "../data/methods";
import { STATUS_CODES } from "../data/statusCodes";
import { SECTIONS } from "../data/sections";
import { ASSERT_PREDICATES, FILTER_FUNCTIONS } from "../data/asserts";
import { OPTIONS } from "../data/options";
import { COMMON_HEADERS } from "../data/headers";

export class HurlHoverProvider implements vscode.HoverProvider {
  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken
  ): vscode.Hover | undefined {
    const lineText = document.lineAt(position.line).text;
    const wordRange = document.getWordRangeAtPosition(position, /[\w.><=!-]+/);
    if (!wordRange) return undefined;

    const word = document.getText(wordRange);

    // HTTP methods
    const method = HTTP_METHODS.find((m) => m.name === word);
    if (method && lineText.match(new RegExp(`^\\s*${method.name}\\s+`))) {
      return new vscode.Hover(
        new vscode.MarkdownString(`**${method.name}** (HTTP Method)\n\n${method.description}`)
      );
    }

    // Status codes on HTTP lines
    const statusMatch = lineText.match(/^\s*HTTP\s+(\d{3})/);
    if (statusMatch) {
      const code = parseInt(statusMatch[1]);
      const status = STATUS_CODES.find((s) => s.code === code);
      if (status && wordRange.contains(document.positionAt(document.offsetAt(position)))) {
        return new vscode.Hover(
          new vscode.MarkdownString(
            `**HTTP ${status.code} ${status.phrase}**\n\n${status.description}`
          )
        );
      }
    }

    // Status code hover (if cursor is on the number)
    const numericWord = parseInt(word);
    if (!isNaN(numericWord) && lineText.match(/^\s*HTTP\s/)) {
      const status = STATUS_CODES.find((s) => s.code === numericWord);
      if (status) {
        return new vscode.Hover(
          new vscode.MarkdownString(
            `**HTTP ${status.code} ${status.phrase}**\n\n${status.description}`
          )
        );
      }
    }

    // Section names
    const sectionMatch = lineText.match(/^\s*\[([\w]+)\]/);
    if (sectionMatch) {
      const section = SECTIONS.find((s) => s.name === sectionMatch[1]);
      if (section) {
        return new vscode.Hover(
          new vscode.MarkdownString(
            `**[${section.name}]** (${section.context} section)\n\n${section.description}`
          )
        );
      }
    }

    // Options
    const optionMatch = lineText.match(/^\s*([\w.-]+)\s*:/);
    if (optionMatch) {
      const option = OPTIONS.find((o) => o.name === optionMatch[1]);
      if (option) {
        return new vscode.Hover(
          new vscode.MarkdownString(
            `**${option.name}** (Option, type: ${option.valueType})\n\n${option.description}`
          )
        );
      }
    }

    // Assert predicates
    const predicate = ASSERT_PREDICATES.find((p) => p.name === word);
    if (predicate) {
      return new vscode.Hover(
        new vscode.MarkdownString(
          `**${predicate.name}** (Assert predicate)\n\n${predicate.description}\n\n\`\`\`hurl\n${predicate.example}\n\`\`\``
        )
      );
    }

    // Filter functions
    const filter = FILTER_FUNCTIONS.find((f) => f.name === word);
    if (filter) {
      return new vscode.Hover(
        new vscode.MarkdownString(
          `**${filter.name}** (Filter function)\n\n${filter.description}\n\n\`\`\`hurl\n${filter.example}\n\`\`\``
        )
      );
    }

    // Headers (Key: Value pattern)
    const headerMatch = lineText.match(/^\s*([\w-]+)\s*:/);
    if (headerMatch) {
      const header = COMMON_HEADERS.find(
        (h) => h.name.toLowerCase() === headerMatch[1].toLowerCase()
      );
      if (header && wordRange.start.character <= headerMatch[1].length) {
        return new vscode.Hover(
          new vscode.MarkdownString(
            `**${header.name}** (HTTP Header)\n\n${header.description}`
          )
        );
      }
    }

    // Variables {{name}}
    const varMatch = lineText.match(/\{\{(\w+)\}\}/);
    if (varMatch && word === varMatch[1]) {
      return new vscode.Hover(
        new vscode.MarkdownString(
          `**{{${varMatch[1]}}}** (Hurl variable)\n\nThis variable is resolved at runtime. It can be defined via captures, \`--variable\` flag, or a variables file.`
        )
      );
    }

    return undefined;
  }
}

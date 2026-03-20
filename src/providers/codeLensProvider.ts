import * as vscode from "vscode";
import { parseHurlEntries } from "../utils/hurlParser";

export class HurlCodeLensProvider implements vscode.CodeLensProvider {
  private _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
  public readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

  provideCodeLenses(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken
  ): vscode.CodeLens[] {
    const entries = parseHurlEntries(document);
    const lenses: vscode.CodeLens[] = [];

    for (const entry of entries) {
      const range = new vscode.Range(entry.startLine, 0, entry.startLine, 0);

      // Run this single entry
      lenses.push(
        new vscode.CodeLens(range, {
          title: "$(play) Run Request",
          command: "hurl-toolkit.runEntry",
          arguments: [document.uri, entry.entryIndex + 1],
          tooltip: `Run this ${entry.method} request with hurl`,
        })
      );

      // Run entire file (only on the first entry)
      if (entry.entryIndex === 0) {
        lenses.push(
          new vscode.CodeLens(range, {
            title: "$(run-all) Run All",
            command: "hurl-toolkit.runFile",
            arguments: [document.uri],
            tooltip: "Run all requests in this file",
          })
        );
      }
    }

    return lenses;
  }
}

export function createRunEntryCommand(
  outputChannel: vscode.OutputChannel
): (uri: vscode.Uri, entryIndex: number) => Promise<void> {
  return async (uri: vscode.Uri, entryIndex: number) => {
    const config = vscode.workspace.getConfiguration("hurl-toolkit");
    const hurlPath = config.get<string>("hurlPath", "hurl");
    const showWebview = config.get<boolean>("showResponseInWebview", false);
    const additionalArgs = config.get<string>("additionalArguments", "");
    const variablesFile = config.get<string>("variablesFile", "");

    const args: string[] = ["--very-verbose", "--entry", String(entryIndex)];

    if (variablesFile) {
      args.push("--variables-file", variablesFile);
    }

    if (additionalArgs) {
      args.push(...additionalArgs.split(/\s+/).filter(Boolean));
    }

    args.push(uri.fsPath);

    outputChannel.clear();
    outputChannel.show(true);
    outputChannel.appendLine(`> ${hurlPath} ${args.join(" ")}`);
    outputChannel.appendLine("");

    try {
      const { execFile } = await import("child_process");
      const { promisify } = await import("util");
      const execFileAsync = promisify(execFile);

      const result = await execFileAsync(hurlPath, args, {
        cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
        timeout: 30000,
        maxBuffer: 10 * 1024 * 1024,
      });

      if (result.stderr) {
        outputChannel.appendLine(result.stderr);
      }
      if (result.stdout) {
        outputChannel.appendLine(result.stdout);
      }

      outputChannel.appendLine("");
      outputChannel.appendLine("--- Request completed successfully ---");

      if (showWebview && result.stdout) {
        showResponseWebview(result.stdout, result.stderr);
      }
    } catch (err: unknown) {
      const error = err as { stderr?: string; stdout?: string; message?: string };
      if (error.stderr) {
        outputChannel.appendLine(error.stderr);
      }
      if (error.stdout) {
        outputChannel.appendLine(error.stdout);
      }
      if (error.message && !error.stderr) {
        outputChannel.appendLine(`Error: ${error.message}`);
      }
      outputChannel.appendLine("");
      outputChannel.appendLine("--- Request failed ---");
    }
  };
}

export function createRunFileCommand(
  outputChannel: vscode.OutputChannel
): (uri: vscode.Uri) => Promise<void> {
  return async (uri: vscode.Uri) => {
    const config = vscode.workspace.getConfiguration("hurl-toolkit");
    const hurlPath = config.get<string>("hurlPath", "hurl");
    const additionalArgs = config.get<string>("additionalArguments", "");
    const variablesFile = config.get<string>("variablesFile", "");

    const args: string[] = ["--very-verbose"];

    if (variablesFile) {
      args.push("--variables-file", variablesFile);
    }

    if (additionalArgs) {
      args.push(...additionalArgs.split(/\s+/).filter(Boolean));
    }

    args.push(uri.fsPath);

    outputChannel.clear();
    outputChannel.show(true);
    outputChannel.appendLine(`> ${hurlPath} ${args.join(" ")}`);
    outputChannel.appendLine("");

    try {
      const { execFile } = await import("child_process");
      const { promisify } = await import("util");
      const execFileAsync = promisify(execFile);

      const result = await execFileAsync(hurlPath, args, {
        cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
        timeout: 60000,
        maxBuffer: 10 * 1024 * 1024,
      });

      if (result.stderr) {
        outputChannel.appendLine(result.stderr);
      }
      if (result.stdout) {
        outputChannel.appendLine(result.stdout);
      }

      outputChannel.appendLine("");
      outputChannel.appendLine("--- All requests completed successfully ---");
    } catch (err: unknown) {
      const error = err as { stderr?: string; stdout?: string; message?: string };
      if (error.stderr) {
        outputChannel.appendLine(error.stderr);
      }
      if (error.stdout) {
        outputChannel.appendLine(error.stdout);
      }
      if (error.message && !error.stderr) {
        outputChannel.appendLine(`Error: ${error.message}`);
      }
      outputChannel.appendLine("");
      outputChannel.appendLine("--- Execution failed ---");
    }
  };
}

function showResponseWebview(stdout: string, stderr: string): void {
  const panel = vscode.window.createWebviewPanel(
    "hurlResponse",
    "Hurl Response",
    vscode.ViewColumn.Beside,
    { enableScripts: false }
  );

  // Try to parse response body from verbose output
  const bodyMatch = stderr.match(/\n\n([\s\S]*?)$/);
  const responseBody = bodyMatch ? bodyMatch[1] : stdout;

  // Try to detect if it's JSON
  let formattedBody: string;
  try {
    const parsed = JSON.parse(responseBody.trim());
    formattedBody = `<pre><code>${escapeHtml(JSON.stringify(parsed, null, 2))}</code></pre>`;
  } catch {
    formattedBody = `<pre><code>${escapeHtml(responseBody)}</code></pre>`;
  }

  // Extract status and headers from verbose output
  const headerLines = stderr
    .split("\n")
    .filter((l) => l.startsWith("< "))
    .map((l) => escapeHtml(l.substring(2)))
    .join("\n");

  panel.webview.html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: var(--vscode-font-family); padding: 16px; color: var(--vscode-foreground); background: var(--vscode-editor-background); }
    h2 { margin-top: 0; }
    pre { background: var(--vscode-textBlockQuote-background); padding: 12px; border-radius: 4px; overflow-x: auto; }
    .section { margin-bottom: 16px; }
    .label { font-weight: bold; margin-bottom: 4px; }
  </style>
</head>
<body>
  <h2>Hurl Response</h2>
  ${headerLines ? `<div class="section"><div class="label">Response Headers</div><pre><code>${headerLines}</code></pre></div>` : ""}
  <div class="section"><div class="label">Response Body</div>${formattedBody}</div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

import * as vscode from "vscode";
import { parseHurlEntries } from "../utils/hurlParser";
import { HurlEnvironmentManager } from "../utils/environmentManager";

let responsePanel: vscode.WebviewPanel | undefined;

export class HurlCodeLensProvider implements vscode.CodeLensProvider {
  private readonly _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
  public readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

  provideCodeLenses(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken
  ): vscode.CodeLens[] {
    const entries = parseHurlEntries( document );
    const lenses: vscode.CodeLens[] = [];

    for ( const entry of entries ) {
      const range = new vscode.Range( entry.startLine, 0, entry.startLine, 0 );

      // Run this single entry
      lenses.push(
        new vscode.CodeLens( range, {
          title: "$(play) Run Request",
          command: "hurl-toolkit.runEntry",
          arguments: [ document.uri, entry.entryIndex + 1 ],
          tooltip: `Run this ${entry.method} request with hurl`,
        } )
      );

      // Run entire file (only on the first entry)
      if ( entry.entryIndex === 0 ) {
        lenses.push(
          new vscode.CodeLens( range, {
            title: "$(run-all) Run All",
            command: "hurl-toolkit.runFile",
            arguments: [ document.uri ],
            tooltip: "Run all requests in this file",
          } )
        );
      }
    }

    return lenses;
  }
}

export function createRunEntryCommand(
  outputChannel: vscode.OutputChannel
  , environmentManager: HurlEnvironmentManager
): ( uri: vscode.Uri, entryIndex: number ) => Promise<void> {
  return async ( uri: vscode.Uri, entryIndex: number ) => {
    await runHurlCommand( outputChannel, environmentManager, uri, {
      entryIndex,
      includeRunRange: true,
      webviewTitle: "Hurl Response",
      webviewMode: "entry",
    } );
  };
}

export function createRunFileCommand(
  outputChannel: vscode.OutputChannel,
  environmentManager: HurlEnvironmentManager
): ( uri: vscode.Uri ) => Promise<void> {
  return async ( uri: vscode.Uri ) => {
    await runHurlCommand( outputChannel, environmentManager, uri, {
      includeRunRange: false,
      webviewTitle: "Hurl Results",
      webviewMode: "file",
    } );
  };
}

type RunMode = "entry" | "file";

interface RunCommandOptions {
  entryIndex?: number;
  includeRunRange: boolean;
  webviewTitle: string;
  webviewMode: RunMode;
}

async function runHurlCommand(
  outputChannel: vscode.OutputChannel,
  environmentManager: HurlEnvironmentManager,
  uri: vscode.Uri,
  options: RunCommandOptions
): Promise<void> {
  const config = environmentManager.resolveRunSettings();
  const showWebview = vscode.workspace.getConfiguration( "hurl-toolkit" ).get<boolean>( "showResponseInWebview", false );
  const args: string[] = [ "--very-verbose" ];

  if ( options.includeRunRange && options.entryIndex !== undefined ) {
    args.push( "--from-entry", String( options.entryIndex ), "--to-entry", String( options.entryIndex ) );
  }

  args.push( ...config.args, uri.fsPath );

  outputChannel.clear();
  outputChannel.show( true );
  outputChannel.appendLine( `[Environment: ${config.activeEnvironmentLabel}]` );
  outputChannel.appendLine( `> ${config.hurlPath} ${args.join( " " )}` );
  outputChannel.appendLine( "" );

  try {
    const { execFile } = await import( "node:child_process" );
    const { promisify } = await import( "node:util" );
    const execFileAsync = promisify( execFile );

    const result = await execFileAsync( config.hurlPath, args, {
      cwd: vscode.workspace.workspaceFolders?.[ 0 ]?.uri.fsPath,
      timeout: 30000,
      maxBuffer: 10 * 1024 * 1024,
      env: config.env,
    } );

    if ( result.stderr ) {
      outputChannel.appendLine( result.stderr );
    }
    if ( result.stdout ) {
      outputChannel.appendLine( result.stdout );
    }

    outputChannel.appendLine( "" );
    outputChannel.appendLine( "--- Request completed successfully ---" );

    if ( showWebview && ( result.stdout || result.stderr ) ) {
      showResponseWebview( options.webviewTitle, options.webviewMode, result.stdout, result.stderr );
    }
  } catch ( err: unknown ) {
    const error = err as { stderr?: string; stdout?: string; message?: string };
    if ( error.stderr ) {
      outputChannel.appendLine( error.stderr );
    }
    if ( error.stdout ) {
      outputChannel.appendLine( error.stdout );
    }
    if ( error.message && !error.stderr ) {
      outputChannel.appendLine( `Error: ${error.message}` );
    }
    outputChannel.appendLine( "" );
    outputChannel.appendLine( options.includeRunRange ? "--- Request failed ---" : "--- Execution failed ---" );
  }
}

function showResponseWebview( title: string, mode: RunMode, stdout: string, stderr: string ): void {
  if ( responsePanel ) {
    responsePanel.title = title;
    responsePanel.reveal( vscode.ViewColumn.Beside );
  } else {
    responsePanel = vscode.window.createWebviewPanel(
      "hurlResponse",
      title,
      vscode.ViewColumn.Beside,
      { enableScripts: false }
    );

    responsePanel.onDidDispose( () => {
      responsePanel = undefined;
    } );
  }

  const panel = responsePanel;

  // Try to parse response body from verbose output
  const bodyMatch = new RegExp( /\n\n([\s\S]*?)$/ ).exec( stderr );
  const responseBody = bodyMatch ? bodyMatch[ 1 ] : stdout;

  // Try to detect if it's JSON
  let formattedBody: string;
  try {
    const parsed = JSON.parse( responseBody.trim() );
    formattedBody = `<pre><code>${escapeHtml( JSON.stringify( parsed, null, 2 ) )}</code></pre>`;
  } catch {
    formattedBody = `<pre><code>${escapeHtml( responseBody )}</code></pre>`;
  }

  // Extract status and headers from verbose output
  const headerLines = stderr
    .split( "\n" )
    .filter( ( l ) => l.startsWith( "< " ) )
    .map( ( l ) => escapeHtml( l.substring( 2 ) ) )
    .join( "\n" );

  const rawOutputSection = mode === "file" && ( stdout || stderr )
    ? `<div class="section"><div class="label">Raw Output</div><pre><code>${escapeHtml( [ stderr, stdout ].filter( Boolean ).join( "\n" ) )}</code></pre></div>`
    : "";

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
  <h2>${escapeHtml( title )}</h2>
  ${rawOutputSection}
  ${headerLines ? `<div class="section"><div class="label">Response Headers</div><pre><code>${headerLines}</code></pre></div>` : ""}
  <div class="section"><div class="label">Response Body</div>${formattedBody}</div>
</body>
</html>`;
}

function escapeHtml( str: string ): string {
  return str
    .replaceAll( '&', "&amp;" )
    .replaceAll( '<', "&lt;" )
    .replaceAll( '>', "&gt;" )
    .replaceAll( '"', "&quot;" );
}

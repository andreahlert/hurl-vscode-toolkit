import * as vscode from "vscode";
import { getContextAtPosition, parseHurlEntries } from "../utils/hurlParser";
import { HurlEnvironmentManager } from "../utils/environmentManager";

let responsePanel: vscode.WebviewPanel | undefined;

export class HurlCodeLensProvider implements vscode.CodeLensProvider {
  private readonly _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
  public readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

  provideCodeLenses(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken
  ): vscode.CodeLens[] {
    // Notebook cells have their own native run buttons — skip CodeLens there
    if ( document.uri.scheme === "vscode-notebook-cell" ) return [];
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
  , environmentManager: HurlEnvironmentManager,
  focusWebview = false
): ( ...args: unknown[] ) => Promise<void> {
  return async ( ...args: unknown[] ) => {
    const target = resolveRunEntryTarget( args );
    if ( !target ) {
      vscode.window.showErrorMessage( "Hurl Toolkit: Open a .hurl file and place the cursor inside a request." );
      return;
    }

    await runHurlCommand( outputChannel, environmentManager, target.uri, {
      entryIndex: target.entryIndex,
      includeRunRange: true,
      webviewTitle: "Hurl Response",
      focusWebview,
    } );
  };
}

export function createRunFileCommand(
  outputChannel: vscode.OutputChannel,
  environmentManager: HurlEnvironmentManager,
  focusWebview = false
): ( ...args: unknown[] ) => Promise<void> {
  return async ( ...args: unknown[] ) => {
    const targetUri = resolveTargetUri( args );
    if ( !targetUri ) {
      vscode.window.showErrorMessage( "Hurl Toolkit: Open a .hurl file before running the file." );
      return;
    }

    await runHurlCommand( outputChannel, environmentManager, targetUri, {
      includeRunRange: false,
      webviewTitle: "Hurl Results",
      focusWebview,
    } );
  };
}

interface RunCommandOptions {
  entryIndex?: number;
  includeRunRange: boolean;
  focusWebview: boolean;
  webviewTitle: string;
}

interface ResponseHeader {
  name: string;
  value: string;
}

interface ParsedResponseOutput {
  statusLine?: string;
  headers: ResponseHeader[];
  body: string;
  contentType?: string;
}

function resolveTargetUri( args: unknown[] ): vscode.Uri | undefined {
  const firstArg = args[ 0 ];

  if ( firstArg instanceof vscode.Uri ) {
    return firstArg;
  }

  if ( firstArg && typeof firstArg === "object" && "scheme" in firstArg && "fsPath" in firstArg ) {
    return firstArg as vscode.Uri;
  }

  const activeEditor = vscode.window.activeTextEditor;
  if ( activeEditor?.document.languageId === "hurl" ) {
    return activeEditor.document.uri;
  }

  return undefined;
}

function resolveRunEntryTarget( args: unknown[] ): { uri: vscode.Uri; entryIndex: number } | undefined {
  const targetUri = resolveTargetUri( args );
  if ( !targetUri ) {
    return undefined;
  }

  const secondArg = args[ 1 ];
  if ( typeof secondArg === "number" && Number.isFinite( secondArg ) ) {
    return { uri: targetUri, entryIndex: secondArg };
  }

  if ( typeof secondArg === "string" ) {
    const parsed = Number( secondArg );
    if ( Number.isFinite( parsed ) ) {
      return { uri: targetUri, entryIndex: parsed };
    }
  }

  const activeEditor = vscode.window.activeTextEditor;
  if ( activeEditor?.document.uri.toString() === targetUri.toString() ) {
    const context = getContextAtPosition( activeEditor.document, activeEditor.selection.active );
    if ( context.currentEntry ) {
      return { uri: targetUri, entryIndex: context.currentEntry.entryIndex + 1 };
    }
  }

  return undefined;
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
      showResponseWebview( options.webviewTitle, result.stdout, result.stderr, undefined, options.focusWebview );
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

    if ( showWebview && ( error.stdout || error.stderr || error.message ) ) {
      showResponseWebview(
        `${options.webviewTitle} (Failed)`,
        error.stdout ?? "",
        error.stderr ?? "",
        error.message,
        options.focusWebview
      );
    }
  }
}

function showResponseWebview( title: string, stdout: string, stderr: string, errorMessage?: string, focusWebview = false ): void {
  if ( responsePanel ) {
    responsePanel.title = title;
    responsePanel.reveal( vscode.ViewColumn.Beside, !focusWebview );
  } else {
    responsePanel = vscode.window.createWebviewPanel(
      "hurlResponse",
      title,
      { viewColumn: vscode.ViewColumn.Beside, preserveFocus: !focusWebview },
      { enableScripts: false, retainContextWhenHidden: true }
    );

    responsePanel.onDidDispose( () => {
      responsePanel = undefined;
    } );
  }

  const panel = responsePanel;
  const parsedOutput = parseResponseOutput( stdout, stderr );
  const headerLines = parsedOutput.headers
    .map( ( header ) => `${header.name}: ${header.value}` )
    .join( "\n" );
  const bodyMarkup = formatBodyMarkup( parsedOutput.body, parsedOutput.contentType );
  const errorMarkup = buildErrorMarkup( stderr, errorMessage );

  panel.webview.html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: var(--vscode-font-family); padding: 16px; color: var(--vscode-foreground); background: var(--vscode-editor-background); }
    h2 { margin-top: 0; }
    pre {
      background: transparent;
      padding: 12px;
      border-radius: 4px;
      overflow-x: auto;
    }
    .json-body pre {
      background: transparent;
      padding: 0;
      border-radius: 0;
    }
    .section { margin-bottom: 16px; }
    .label { font-weight: bold; margin-bottom: 4px; }
    .json-line { white-space: pre; }
    .json-key { color: var(--vscode-symbolIcon-keywordForeground, #c586c0); }
    .json-string { color: var(--vscode-charts-green, #ce9178); }
    .json-number { color: var(--vscode-charts-blue, #b5cea8); }
    .json-boolean { color: var(--vscode-charts-orange, #569cd6); }
    .json-null { color: var(--vscode-descriptionForeground); }
    .json-punctuation { color: var(--vscode-foreground); }
    .json-container { color: var(--vscode-foreground); }
    .json-indent { display: inline-block; width: 1ch; }
    .json-collapsed { color: var(--vscode-descriptionForeground); }
    .line-wrap {
      display: inline;
    }
  </style>
</head>
<body>
  <h2>${escapeHtml( title )}</h2>
  ${errorMarkup}
  ${parsedOutput.statusLine ? `<div class="section"><div class="label">Status</div><pre><code>${escapeHtml( parsedOutput.statusLine )}</code></pre></div>` : ""}
  ${headerLines ? `<div class="section"><div class="label">Response Headers</div><pre><code>${escapeHtml( headerLines )}</code></pre></div>` : ""}
  <div class="section"><div class="label">Response Body</div>${bodyMarkup}</div>
</body>
</html>`;
}

function parseResponseOutput( stdout: string, stderr: string ): ParsedResponseOutput {
  const headers: ResponseHeader[] = [];
  const headerMap = new Map<string, string>();
  const stderrLines = stderr.split( /\r?\n/ );
  let statusLine: string | undefined;
  let body = stdout.trim();

  for ( const line of stderrLines ) {
    const responseLineMatch = /^<\s+(.*)$/.exec( line );
    if ( !responseLineMatch ) {
      continue;
    }

    const value = responseLineMatch[ 1 ].trim();
    if ( /^HTTP\/[\d.]+\s+\d{3}\b/.test( value ) ) {
      statusLine = value;
      continue;
    }

    const separatorIndex = value.indexOf( ":" );
    if ( separatorIndex > 0 ) {
      const name = value.slice( 0, separatorIndex ).trim();
      const headerValue = value.slice( separatorIndex + 1 ).trim();
      headers.push( { name, value: headerValue } );
      headerMap.set( name.toLowerCase(), headerValue );
    }
  }

  if ( !body ) {
    body = extractBodyFromVerboseStderr( stderrLines ) ?? "";
  }

  return {
    statusLine,
    headers,
    body,
    contentType: headerMap.get( "content-type" ),
  };
}

/**
 * Extract the response body from hurl --very-verbose stderr.
 * Hurl emits:
 *   * Response body:
 *   * {line of body}
 *   *
 */
function extractBodyFromVerboseStderr( stderrLines: string[] ): string | undefined {
  let bodyStartIdx = -1;

  for ( let i = 0; i < stderrLines.length; i++ ) {
    if ( /^\*\s+Response body:\s*$/.test( stderrLines[ i ] ) ) {
      bodyStartIdx = i + 1; // always update → picks up the last response
    }
  }

  if ( bodyStartIdx === -1 ) return undefined;

  const bodyLines: string[] = [];
  for ( let i = bodyStartIdx; i < stderrLines.length; i++ ) {
    const m = /^\*\s(.+)$/.exec( stderrLines[ i ] );
    if ( m ) {
      bodyLines.push( m[ 1 ] );
    } else {
      break;
    }
  }

  const body = bodyLines.join( "\n" ).trim();
  return body || undefined;
}

/**
 * Extract all error blocks from hurl stderr, each starting with "error:" and
 * including the full source-location context (-->, | lines, ^^^ underline).
 */
function extractErrorBlocks( stderrLines: string[] ): string | undefined {
  const blocks: string[] = [];
  let i = 0;

  while ( i < stderrLines.length ) {
    const line = stderrLines[ i ];
    if ( line.startsWith( "error:" ) ) {
      const blockLines: string[] = [ line ];
      i++;
      while ( i < stderrLines.length ) {
        const bl = stderrLines[ i ];
        if ( /^\s*(-->|\d*\s*\|)/.test( bl ) ) {
          blockLines.push( bl );
          i++;
        } else {
          break;
        }
      }
      blocks.push( blockLines.join( "\n" ).trimEnd() );
      continue;
    }
    i++;
  }

  return blocks.length > 0 ? blocks.join( "\n\n" ).trim() : undefined;
}

function buildErrorMarkup( stderr: string, errorMessage?: string ): string {
  if ( errorMessage ) {
    return `<div class="section"><div class="label">Failure</div><pre><code>${escapeHtml( errorMessage )}</code></pre></div>`;
  }

  if ( !stderr ) return "";

  const stderrLines = stderr.split( /\r?\n/ );
  const snippet = extractErrorBlocks( stderrLines );
  if ( snippet ) {
    return `<div class="section"><div class="label">Failure</div><pre><code>${escapeHtml( snippet )}</code></pre></div>`;
  }

  return "";
}

function formatBodyMarkup( body: string, contentType?: string ): string {
  if ( !body ) {
    return '<div class="empty-state">No response body captured.</div>';
  }

  const trimmedBody = body.trim();
  const shouldFormatAsJson = /json/i.test( contentType ?? "" ) || /^[\[{]/.test( trimmedBody );

  if ( shouldFormatAsJson ) {
    try {
      return `<div class="json-body"><pre><code>${renderJsonWithColors( JSON.parse( trimmedBody ) )}</code></pre></div>`;
    } catch {
      // Fall through to plain text rendering.
    }
  }

  return `<pre><code>${escapeHtml( body )}</code></pre>`;
}


function renderJsonWithColors( value: unknown, indent = 0 ): string {
  const indentText = "  ".repeat( indent );

  if ( value === null ) {
    return `<span class="json-null">null</span>`;
  }

  if ( Array.isArray( value ) ) {
    if ( value.length === 0 ) {
      return `<span class="json-punctuation">[]</span>`;
    }

    const items = value.map( ( item ) => `${indentText}  ${renderJsonWithColors( item, indent + 1 )}` ).join( ",\n" );
    return `<span class="json-punctuation">[</span>\n${items}\n${indentText}<span class="json-punctuation">]</span>`;
  }

  if ( typeof value === "object" ) {
    const entries = Object.entries( value as Record<string, unknown> );
    if ( entries.length === 0 ) {
      return `<span class="json-punctuation">{}</span>`;
    }

    const properties = entries.map( ( [ key, item ] ) => {
      const renderedValue = renderJsonWithColors( item, indent + 1 );
      return `${indentText}  <span class="json-key">"${escapeHtml( key )}"</span><span class="json-punctuation">:</span> ${renderedValue}`;
    } ).join( ",\n" );

    return `<span class="json-punctuation">{</span>\n${properties}\n${indentText}<span class="json-punctuation">}</span>`;
  }

  if ( typeof value === "string" ) {
    return `<span class="json-string">"${escapeHtml( value )}"</span>`;
  }

  if ( typeof value === "number" ) {
    return `<span class="json-number">${String( value )}</span>`;
  }

  if ( typeof value === "boolean" ) {
    return `<span class="json-boolean">${String( value )}</span>`;
  }

  return `<span class="json-collapsed">${escapeHtml( String( value ) )}</span>`;
}

function escapeHtml( str: string ): string {
  return str
    .replaceAll( '&', "&amp;" )
    .replaceAll( '<', "&lt;" )
    .replaceAll( '>', "&gt;" )
    .replaceAll( '"', "&quot;" );
}

import * as vscode from "vscode";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { HurlEnvironmentManager } from "../utils/environmentManager";

export const HURL_NOTEBOOK_TYPE = "hurl-notebook";
const CONTROLLER_ID = "hurl-toolkit-controller";
const CONTROLLER_LABEL = "Hurl Toolkit";

export class HurlNotebookController {
  private readonly controller: vscode.NotebookController;

  constructor(
    context: vscode.ExtensionContext,
    private readonly environmentManager: HurlEnvironmentManager
  ) {
    this.controller = vscode.notebooks.createNotebookController(
      CONTROLLER_ID,
      HURL_NOTEBOOK_TYPE,
      CONTROLLER_LABEL
    );
    this.controller.supportedLanguages = [ "hurl" ];
    this.controller.supportsExecutionOrder = true;
    this.controller.executeHandler = this.executeHandler.bind( this );

    const setPreferred = ( notebook: vscode.NotebookDocument ) => {
      if ( notebook.notebookType === HURL_NOTEBOOK_TYPE ) {
        this.controller.updateNotebookAffinity(
          notebook,
          vscode.NotebookControllerAffinity.Preferred
        );
      }
    };
    vscode.workspace.notebookDocuments.forEach( setPreferred );
    context.subscriptions.push(
      vscode.workspace.onDidOpenNotebookDocument( setPreferred ),
      { dispose: () => this.controller.dispose() }
    );
  }

  private async executeHandler(
    cells: vscode.NotebookCell[],
    _notebook: vscode.NotebookDocument,
    controller: vscode.NotebookController
  ): Promise<void> {
    for ( const cell of cells ) {
      await this.executeCell( cell, controller );
    }
  }

  private async executeCell(
    cell: vscode.NotebookCell,
    controller: vscode.NotebookController
  ): Promise<void> {
    const execution = controller.createNotebookCellExecution( cell );
    execution.start( Date.now() );
    execution.clearOutput();

    const hurlContent = cell.document.getText().trim();
    if ( !hurlContent ) {
      execution.end( true, Date.now() );
      return;
    }

    let tempDir: string | undefined;
    try {
      const { execFile } = await import( "node:child_process" );
      const { promisify } = await import( "node:util" );
      const execFileAsync = promisify( execFile );
      const settings = this.environmentManager.resolveRunSettings();

      tempDir = await fs.mkdtemp( path.join( os.tmpdir(), "hurl-toolkit-nb-" ) );
      const tempFile = path.join( tempDir, "cell.hurl" );
      await fs.writeFile( tempFile, hurlContent, "utf-8" );

      const args = [ "--very-verbose", ...settings.args, tempFile ];

      let stdout = "";
      let stderr = "";
      let success = false;

      try {
        const result = await execFileAsync( settings.hurlPath, args, {
          cwd: vscode.workspace.workspaceFolders?.[ 0 ]?.uri.fsPath,
          timeout: 30000,
          maxBuffer: 10 * 1024 * 1024,
          env: settings.env,
        } );
        stdout = result.stdout;
        stderr = result.stderr;
        success = true;
      } catch ( err: unknown ) {
        const error = err as { stderr?: string; stdout?: string; message?: string; code?: number };
        stdout = error.stdout ?? "";
        stderr = error.stderr ?? "";
        // hurl exits non-zero when assertions fail — that's still a valid response
        success = false;
      }

      // Persist captured variables to the active environment profile
      const stderrLines = stderr.split( /\r?\n/ );
      const captures = parseCapturedVariables( stderrLines );
      const profileName = this.environmentManager.getActiveEnvironmentName();
      if ( profileName && Object.keys( captures ).length > 0 ) {
        for ( const [ name, value ] of Object.entries( captures ) ) {
          await this.environmentManager.saveVariableToProfile( profileName, name, value );
        }
      }

      const md = buildMarkdownOutput( stdout, stderr, success, settings.activeEnvironmentLabel );
      await execution.appendOutput( [
        new vscode.NotebookCellOutput( [
          vscode.NotebookCellOutputItem.text( md, "text/markdown" ),
        ] ),
      ] );
      execution.end( success, Date.now() );
    } catch ( error ) {
      const message = error instanceof Error ? error.message : String( error );
      await execution.appendOutput( [
        new vscode.NotebookCellOutput( [
          vscode.NotebookCellOutputItem.error( { name: "HurlNotebookError", message } ),
        ] ),
      ] );
      execution.end( false, Date.now() );
    } finally {
      if ( tempDir ) {
        await fs.rm( tempDir, { recursive: true, force: true } ).catch( () => undefined );
      }
    }
  }
}

function buildMarkdownOutput(
  stdout: string,
  stderr: string,
  success: boolean,
  envLabel: string
): string {
  const lines: string[] = [];
  const icon = success ? "✅" : "❌";

  // Parse status line and response headers from --very-verbose stderr
  const stderrLines = stderr.split( /\r?\n/ );
  let statusLine: string | undefined;
  const responseHeaders: string[] = [];

  for ( const line of stderrLines ) {
    const responseLineMatch = /^<\s+(.*)$/.exec( line );
    if ( !responseLineMatch ) continue;
    const value = responseLineMatch[ 1 ].trim();
    if ( /^HTTP\/[\d.]+\s+\d{3}\b/.test( value ) ) {
      statusLine = value;
    } else if ( value.includes( ":" ) ) {
      responseHeaders.push( value );
    }
  }

  lines.push( `${icon} **${success ? "Success" : "Failed"}** — *${envLabel}*` );
  lines.push( "" );

  if ( statusLine ) {
    lines.push( `**Status:** \`${statusLine}\`` );
    lines.push( "" );
  }

  if ( responseHeaders.length > 0 ) {
    lines.push( "<details><summary>Response Headers</summary>" );
    lines.push( "" );
    lines.push( "```" );
    lines.push( responseHeaders.join( "\n" ) );
    lines.push( "```" );
    lines.push( "" );
    lines.push( "</details>" );
    lines.push( "" );
  }

  // Show response body — fall back to extracting from verbose stderr output when
  // hurl did not write to stdout (e.g. assertion failures on some hurl versions).
  const body = stdout.trim() || extractBodyFromVerboseStderr( stderrLines );
  if ( body ) {
    const formatted = tryFormatJson( body );
    lines.push( "```" + ( formatted ? "json" : "" ) );
    lines.push( formatted ?? body );
    lines.push( "```" );
    lines.push( "" );
  }

  if ( !success ) {
    const errorSnippet = extractErrorSnippet( stderrLines );
    if ( errorSnippet ) {
      lines.push( "**Error:**" );
      lines.push( "```" );
      lines.push( errorSnippet );
      lines.push( "```" );
    }
  }

  return lines.join( "\n" );
}

/**
 * Parse variables captured by a [Captures] section from hurl --very-verbose stderr.
 * Hurl emits a block like:
 *   * Captures
 *       token: abc123
 *       user_id: 42
 */
function parseCapturedVariables( stderrLines: string[] ): Record<string, string> {
  const captures: Record<string, string> = {};
  let inCaptures = false;

  for ( const line of stderrLines ) {
    // Detect start of Captures block (e.g. "* Captures" or "* Captures:")
    if ( /^\*\s+Captures:?\s*$/.test( line ) ) {
      inCaptures = true;
      continue;
    }

    if ( !inCaptures ) continue;

    // Capture entry: "*   name: value"
    const match = /^\*\s{2,}([A-Za-z][A-Za-z0-9_-]*)\s*:\s*(.+)$/.exec( line );
    if ( match ) {
      // Strip surrounding double-quotes that hurl adds for string values
      captures[ match[ 1 ] ] = match[ 2 ].trim().replace( /^"(.*)"$/, "$1" );
    } else {
      // Any non-capture `*` line (new section) or non-`*` line ends the block
      inCaptures = false;
    }
  }

  return captures;
}

/**
 * Extract the response body from hurl --very-verbose stderr output.
 * After response headers hurl emits a blank `<` separator line; the body
 * follows as raw lines until the next `*` or `>` info line.
 */
function extractBodyFromVerboseStderr( stderrLines: string[] ): string | undefined {
  let lastStatusIdx = -1;

  for ( let i = 0; i < stderrLines.length; i++ ) {
    if ( /^<\s+HTTP\/[\d.]+\s+\d{3}\b/.test( stderrLines[ i ] ) ) {
      lastStatusIdx = i;
    }
  }

  if ( lastStatusIdx === -1 ) return undefined;

  // Advance past response header lines to the blank `<` separator
  let bodyStartIdx = -1;
  for ( let i = lastStatusIdx + 1; i < stderrLines.length; i++ ) {
    const line = stderrLines[ i ];
    if ( /^<\s*$/.test( line ) ) {
      bodyStartIdx = i + 1;
      break;
    }
    if ( !/^</.test( line ) ) break;
  }

  if ( bodyStartIdx === -1 ) return undefined;

  // Collect body lines until the next section marker
  const bodyLines: string[] = [];
  for ( let i = bodyStartIdx; i < stderrLines.length; i++ ) {
    const line = stderrLines[ i ];
    if ( /^[*>]/.test( line ) || /^<\s+HTTP\//.test( line ) ) break;
    bodyLines.push( line );
  }

  const body = bodyLines.join( "\n" ).trim();
  return body || undefined;
}

function tryFormatJson( text: string ): string | undefined {
  const trimmed = text.trim();
  if ( !trimmed.startsWith( "{" ) && !trimmed.startsWith( "[" ) ) return undefined;
  try {
    return JSON.stringify( JSON.parse( trimmed ), null, 2 );
  } catch {
    return undefined;
  }
}

function extractErrorSnippet( stderrLines: string[] ): string | undefined {
  const arrowIdx = stderrLines.findIndex( l => /^\s*-->/.test( l ) );
  if ( arrowIdx !== -1 ) {
    const start = Math.max( 0, arrowIdx - 1 );
    return stderrLines.slice( start, Math.min( stderrLines.length, arrowIdx + 5 ) ).join( "\n" ).trim();
  }
  const errorLine = stderrLines.find( l => /\b(error|failed)\b/i.test( l ) && !/^[<>*]/.test( l.trim() ) );
  return errorLine?.trim();
}

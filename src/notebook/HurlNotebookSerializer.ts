import * as vscode from "vscode";

const MD_LINE_PREFIX = "# md: ";
const HTTP_METHOD_RE = /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|CONNECT|TRACE)\s/;

export class HurlNotebookSerializer implements vscode.NotebookSerializer {
  async deserializeNotebook(
    content: Uint8Array,
    _token: vscode.CancellationToken
  ): Promise<vscode.NotebookData> {
    const text = Buffer.from( content ).toString( "utf-8" );
    return new vscode.NotebookData( hurlTextToCells( text ) );
  }

  async serializeNotebook(
    data: vscode.NotebookData,
    _token: vscode.CancellationToken
  ): Promise<Uint8Array> {
    return Buffer.from( cellsToHurlText( data.cells ), "utf-8" );
  }
}

export function hurlTextToCells( text: string ): vscode.NotebookCellData[] {
  const lines = text.split( "\n" );
  const cells: vscode.NotebookCellData[] = [];

  let codeCellLines: string[] = [];
  let mdLines: string[] = [];

  const flushMd = () => {
    if ( mdLines.length === 0 ) return;
    cells.push( new vscode.NotebookCellData(
      vscode.NotebookCellKind.Markup,
      mdLines.join( "\n" ),
      "markdown"
    ) );
    mdLines = [];
  };

  const flushCode = () => {
    const trimmed = codeCellLines.join( "\n" ).trim();
    codeCellLines = [];
    if ( !trimmed ) return;
    cells.push( new vscode.NotebookCellData(
      vscode.NotebookCellKind.Code,
      trimmed,
      "hurl"
    ) );
  };

  for ( const line of lines ) {
    if ( line.startsWith( MD_LINE_PREFIX ) ) {
      // Flush any pending code before markdown block
      flushCode();
      mdLines.push( line.slice( MD_LINE_PREFIX.length ) );
    } else if ( HTTP_METHOD_RE.test( line ) ) {
      // New request entry — flush both pending blocks first
      flushMd();
      flushCode();
      codeCellLines.push( line );
    } else {
      // Regular content — flush pending markdown (non-md: line ends an md block)
      if ( mdLines.length > 0 ) {
        flushMd();
      }
      codeCellLines.push( line );
    }
  }

  flushMd();
  flushCode();

  return cells;
}

export function cellsToHurlText( cells: vscode.NotebookCellData[] ): string {
  const parts: string[] = [];
  for ( const cell of cells ) {
    if ( cell.kind === vscode.NotebookCellKind.Markup ) {
      const encoded = cell.value
        .split( "\n" )
        .map( line => `${MD_LINE_PREFIX}${line}` )
        .join( "\n" );
      parts.push( encoded );
    } else {
      parts.push( cell.value );
    }
  }
  return parts.join( "\n\n" );
}

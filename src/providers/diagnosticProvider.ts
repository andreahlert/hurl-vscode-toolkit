import * as vscode from "vscode";
import { METHOD_NAMES } from "../data/methods";
import { SECTION_NAMES } from "../data/sections";

const VALID_STATUS_RANGE_MIN = 100;
const VALID_STATUS_RANGE_MAX = 599;

export class HurlDiagnosticProvider {
  private diagnosticCollection: vscode.DiagnosticCollection;

  constructor( diagnosticCollection: vscode.DiagnosticCollection ) {
    this.diagnosticCollection = diagnosticCollection;
  }

  public updateDiagnostics( document: vscode.TextDocument ): void {
    if ( document.languageId !== "hurl" ) {
      return;
    }

    const diagnostics: vscode.Diagnostic[] = [];

    for ( let i = 0; i < document.lineCount; i++ ) {
      const line = document.lineAt( i );
      const text = line.text;
      const trimmed = text.trimStart();

      // Skip empty lines and comments
      if ( trimmed === "" || trimmed.startsWith( "#" ) ) {
        continue;
      }

      // Check for invalid HTTP methods (lines that look like method lines but have invalid methods)
      const methodMatch = trimmed.match( /^([A-Z]{2,10})\s+(https?:\/\/|{{)/ );
      if ( methodMatch ) {
        const method = methodMatch[ 1 ];
        if ( !METHOD_NAMES.includes( method ) ) {
          const startIdx = text.indexOf( method );
          diagnostics.push(
            new vscode.Diagnostic(
              new vscode.Range( i, startIdx, i, startIdx + method.length ),
              `Unknown HTTP method: ${method}. Valid methods: ${METHOD_NAMES.join( ", " )}`,
              vscode.DiagnosticSeverity.Error
            )
          );
        }
      }

      // Check for malformed URLs on method lines
      const urlMatch = trimmed.match( /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|CONNECT|TRACE)\s+(.+)$/ );
      if ( urlMatch ) {
        const url = urlMatch[ 2 ].trim();
        // URL should start with http://, https://, or a variable {{
        if ( !url.match( /^(https?:\/\/|{{)/ ) ) {
          const urlStart = text.indexOf( url );
          diagnostics.push(
            new vscode.Diagnostic(
              new vscode.Range( i, urlStart, i, urlStart + url.length ),
              "URL should start with http://, https://, or a variable reference {{...}}",
              vscode.DiagnosticSeverity.Warning
            )
          );
        }
      }

      // Check for unknown section names
      const sectionMatch = trimmed.match( /^\[(\w+)\]/ );
      if ( sectionMatch ) {
        const sectionName = sectionMatch[ 1 ];
        if ( !SECTION_NAMES.includes( sectionName ) ) {
          const startIdx = text.indexOf( `[${sectionName}]` );
          diagnostics.push(
            new vscode.Diagnostic(
              new vscode.Range( i, startIdx, i, startIdx + sectionName.length + 2 ),
              `Unknown section: [${sectionName}]. Valid sections: ${SECTION_NAMES.join( ", " )}`,
              vscode.DiagnosticSeverity.Error
            )
          );
        }
      }

      // Check for invalid status codes
      const statusMatch = trimmed.match( /^HTTP\s+(\d+)/ );
      if ( statusMatch ) {
        const code = parseInt( statusMatch[ 1 ] );
        if ( code < VALID_STATUS_RANGE_MIN || code > VALID_STATUS_RANGE_MAX ) {
          const codeStr = statusMatch[ 1 ];
          const startIdx = text.indexOf( codeStr, text.indexOf( "HTTP" ) );
          diagnostics.push(
            new vscode.Diagnostic(
              new vscode.Range( i, startIdx, i, startIdx + codeStr.length ),
              `Invalid HTTP status code: ${code}. Status codes must be between ${VALID_STATUS_RANGE_MIN} and ${VALID_STATUS_RANGE_MAX}.`,
              vscode.DiagnosticSeverity.Error
            )
          );
        }
      }

      // Check for unclosed variables {{ without }}
      let varSearchStart = 0;
      while ( true ) {
        const openIdx = text.indexOf( "{{", varSearchStart );
        if ( openIdx === -1 ) break;
        const closeIdx = text.indexOf( "}}", openIdx + 2 );
        if ( closeIdx === -1 ) {
          diagnostics.push(
            new vscode.Diagnostic(
              new vscode.Range( i, openIdx, i, text.length ),
              "Unclosed variable reference. Expected closing }}.",
              vscode.DiagnosticSeverity.Error
            )
          );
          break;
        }
        varSearchStart = closeIdx + 2;
      }

      // Semantic checks for query/filter compatibility inside [Asserts] and [Captures]
      // Track current section by scanning backwards to nearest section header for this line
      let currentSection: string | undefined;
      for ( let j = i; j >= 0; j-- ) {
        const t = document.lineAt( j ).text.trim();
        const m = t.match( /^\[([A-Za-z]+)\]/ );
        if ( m ) {
          currentSection = m[ 1 ];
          break;
        }
        // if we hit an HTTP status line before a section header, stop
        if ( t.match( /^HTTP\s/ ) ) {
          break;
        }
      }

      if ( currentSection === "Asserts" || currentSection === "Captures" ) {
        const lineTrim = trimmed;
        // Extract the query type (first token)
        const queryMatch = lineTrim.match( /^([A-Za-z0-9_-]+)\b/ );
        if ( queryMatch ) {
          const queryType = queryMatch[ 1 ];

          // Commonly incompatible filters
          const incompatibleFilters = [ "jsonpath", "xpath", "urlQueryParam", "toDate", "dateFormat", "daysAfterNow", "daysBeforeNow" ];

          for ( const f of incompatibleFilters ) {
            const re = new RegExp( `\\b${f}\\b`, "i" );
            if ( re.test( lineTrim ) ) {
              // Heuristic: some queries are unlikely to be combined with these filters
              const disallowedOn = [ "status", "version", "ip", "duration", "redirects", "sha256", "md5", "bytes", "rawbytes" ];
              if ( disallowedOn.includes( queryType.toLowerCase() ) ) {
                const idx = text.toLowerCase().indexOf( f );
                if ( idx >= 0 ) {
                  diagnostics.push(
                    new vscode.Diagnostic(
                      new vscode.Range( i, idx, i, idx + f.length ),
                      `Filter/function '${f}' looks incompatible with query type '${queryType}'.`,
                      vscode.DiagnosticSeverity.Warning
                    )
                  );
                }
              }
            }
          }

          // urlQueryParam is only meaningful on URL/redirects or values that contain URLs
          if ( /\burlQueryParam\b/i.test( lineTrim ) && !/^url\b/i.test( queryType ) && !/^redirects\b/i.test( queryType ) ) {
            const idx = text.toLowerCase().indexOf( "urlqueryparam" );
            if ( idx >= 0 ) {
              diagnostics.push(
                new vscode.Diagnostic(
                  new vscode.Range( i, idx, i, idx + "urlQueryParam".length ),
                  "'urlQueryParam' is generally used on URLs (query 'url' or 'redirects' entries).",
                  vscode.DiagnosticSeverity.Warning
                )
              );
            }
          }
        }
      }
    }

    this.diagnosticCollection.set( document.uri, diagnostics );
  }

  public dispose(): void {
    this.diagnosticCollection.dispose();
  }
}

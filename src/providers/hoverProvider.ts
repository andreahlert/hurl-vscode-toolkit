import * as vscode from "vscode";
import { HTTP_METHODS } from "../data/methods";
import { STATUS_CODES } from "../data/statusCodes";
import { SECTIONS } from "../data/sections";
import { ASSERT_PREDICATES, FILTER_FUNCTIONS } from "../data/asserts";
import { OPTIONS } from "../data/options";
import { COMMON_HEADERS } from "../data/headers";
import { collectHurlVariableDefinitions } from "../utils/hurlParser";

export class HurlHoverProvider implements vscode.HoverProvider {
  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken
  ): vscode.Hover | undefined {
    const lineText = document.lineAt( position.line ).text;
    const wordRange = document.getWordRangeAtPosition( position, /[A-Za-z0-9_\-.><=!-]+/ );
    if ( !wordRange ) return undefined;

    const word = document.getText( wordRange );

    // GraphQL fenced block hover: provide simple keyword hints
    if ( this.isInsideFencedBlock( document, position, "graphql" ) ) {
      const gqlKeywords = new Set( [ "query", "mutation", "subscription", "fragment", "on", "schema" ] );
      if ( gqlKeywords.has( word ) ) {
        return new vscode.Hover( new vscode.MarkdownString( `**${word}** (GraphQL keyword)` ) );
      }
    }

    // HTTP methods
    const method = HTTP_METHODS.find( ( m ) => m.name === word );
    if ( method && lineText.match( new RegExp( `^\\s*${method.name}\\s+` ) ) ) {
      return new vscode.Hover(
        new vscode.MarkdownString( `**${method.name}** (HTTP Method)\n\n${method.description}` )
      );
    }

    // Status codes on HTTP lines
    const statusMatch = lineText.match( /^\s*HTTP\s+(\d{3})/ );
    if ( statusMatch ) {
      const code = parseInt( statusMatch[ 1 ] );
      const status = STATUS_CODES.find( ( s ) => s.code === code );
      if ( status && wordRange.contains( document.positionAt( document.offsetAt( position ) ) ) ) {
        return new vscode.Hover(
          new vscode.MarkdownString(
            `**HTTP ${status.code} ${status.phrase}**\n\n${status.description}`
          )
        );
      }
    }

    // Status code hover (if cursor is on the number)
    const numericWord = parseInt( word );
    if ( !isNaN( numericWord ) && lineText.match( /^\s*HTTP\s/ ) ) {
      const status = STATUS_CODES.find( ( s ) => s.code === numericWord );
      if ( status ) {
        return new vscode.Hover(
          new vscode.MarkdownString(
            `**HTTP ${status.code} ${status.phrase}**\n\n${status.description}`
          )
        );
      }
    }

    // Section names
    const sectionMatch = lineText.match( /^\s*\[([\w]+)\]/ );
    if ( sectionMatch ) {
      const section = SECTIONS.find( ( s ) => s.name === sectionMatch[ 1 ] );
      if ( section ) {
        return new vscode.Hover(
          new vscode.MarkdownString(
            `**[${section.name}]** (${section.context} section)\n\n${section.description}`
          )
        );
      }
    }

    // Options
    const optionMatch = lineText.match( /^\s*([\w.-]+)\s*:/ );
    if ( optionMatch ) {
      const option = OPTIONS.find( ( o ) => o.name === optionMatch[ 1 ] );
      if ( option ) {
        return new vscode.Hover(
          new vscode.MarkdownString(
            `**${option.name}** (Option, type: ${option.valueType})\n\n${option.description}`
          )
        );
      }
    }

    // Assert predicates
    const predicate = ASSERT_PREDICATES.find( ( p ) => p.name === word );
    if ( predicate ) {
      return new vscode.Hover(
        new vscode.MarkdownString(
          `**${predicate.name}** (Assert predicate)\n\n${predicate.description}\n\n\`\`\`hurl\n${predicate.example}\n\`\`\``
        )
      );
    }

    // Filter functions
    const filter = FILTER_FUNCTIONS.find( ( f ) => f.name === word );
    if ( filter ) {
      return new vscode.Hover(
        new vscode.MarkdownString(
          `**${filter.name}** (Filter function)\n\n${filter.description}\n\n\`\`\`hurl\n${filter.example}\n\`\`\``
        )
      );
    }

    // Headers (Key: Value pattern)
    const headerMatch = lineText.match( /^\s*([\w-]+)\s*:/ );
    if ( headerMatch ) {
      const header = COMMON_HEADERS.find(
        ( h ) => h.name.toLowerCase() === headerMatch[ 1 ].toLowerCase()
      );
      if ( header && wordRange.start.character <= headerMatch[ 1 ].length ) {
        return new vscode.Hover(
          new vscode.MarkdownString(
            `**${header.name}** (HTTP Header)\n\n${header.description}`
          )
        );
      }
    }

    // Variables {{name}} and variable "name"
    const variableDefinitions = collectHurlVariableDefinitions( document ).filter( ( v ) => v.name === word );
    if ( variableDefinitions.length > 0 ) {
      const hasCapture = variableDefinitions.some( ( v ) => v.source === "capture" );
      const hasOptionVariable = variableDefinitions.some( ( v ) => v.source === "option-variable" );

      const sourceParts: string[] = [];
      if ( hasCapture ) {
        sourceParts.push( "captured in [Captures]" );
      }
      if ( hasOptionVariable ) {
        sourceParts.push( "defined in [Options] with variable:" );
      }
      if ( sourceParts.length === 0 ) {
        sourceParts.push( "referenced in templates / variable queries" );
      }

      return new vscode.Hover(
        new vscode.MarkdownString(
          `**{{${word}}}** (Hurl variable)\n\nSource: ${sourceParts.join( ", " )}\n\nVariables can also be injected with \`--variable\`, \`--variables-file\` or \`HURL_VARIABLE_*\` environment variables.`
        )
      );
    }

    return undefined;
  }

  private isInsideFencedBlock( document: vscode.TextDocument, position: vscode.Position, lang: string ): boolean {
    for ( let i = position.line; i >= 0; i-- ) {
      const text = document.lineAt( i ).text.trim();
      if ( text.startsWith( "```" + lang ) ) return true;
      if ( text.startsWith( "```" ) && !text.startsWith( "```" + lang ) ) return false;
    }
    return false;
  }
}

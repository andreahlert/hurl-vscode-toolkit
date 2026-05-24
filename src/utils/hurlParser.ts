import * as vscode from "vscode";
import { METHOD_NAMES } from "../data/methods";

const VARIABLE_NAME_PATTERN = "[A-Za-z][A-Za-z0-9_-]*";
const SECTION_PATTERN = /^(QueryStringParams|Query|FormParams|Form|MultipartFormData|Multipart|Cookies|Options|Asserts|Captures|BasicAuth)$/;
const TEMPLATE_FUNCTIONS = new Set( [ "newDate", "newUuid", "getEnv" ] );

const SECTION_ALIASES: Record<string, string> = {
  QueryStringParams: "QueryStringParams",
  Query: "QueryStringParams",
  FormParams: "FormParams",
  Form: "FormParams",
  MultipartFormData: "MultipartFormData",
  Multipart: "MultipartFormData",
  Cookies: "Cookies",
  Options: "Options",
  Asserts: "Asserts",
  Captures: "Captures",
  BasicAuth: "BasicAuth",
};

export interface HurlEntry {
  method: string;
  url: string;
  startLine: number;
  endLine: number;
  entryIndex: number;
}

export interface HurlVariableDefinition {
  name: string;
  source: "capture" | "option-variable" | "placeholder-usage" | "variable-query";
  line: number;
}

/**
 * Parses a Hurl document and returns all request entries.
 */
export function parseHurlEntries( document: vscode.TextDocument ): HurlEntry[] {
  const entries: HurlEntry[] = [];
  const lineCount = document.lineCount;
  let entryIndex = 0;
  let currentEntry: HurlEntry | undefined;

  for ( let i = 0; i < lineCount; i++ ) {
    const lineText = document.lineAt( i ).text.trimStart();
    if ( /^HTTP\b/.test( lineText ) ) {
      if ( currentEntry ) {
        currentEntry.endLine = i;
      }
      continue;
    }

    const match = lineText.match( /^([A-Z]{2,20})\s+(.+)$/ );
    if ( match ) {
      // Close the previous entry
      if ( currentEntry ) {
        currentEntry.endLine = i - 1;
      }

      currentEntry = {
        method: match[ 1 ],
        url: match[ 2 ].trim(),
        startLine: i,
        endLine: lineCount - 1,
        entryIndex: entryIndex++,
      };
      entries.push( currentEntry );
    }
    else if ( currentEntry ) {
      currentEntry.endLine = i;
    }
  }

  return entries;
}

/**
 * Determines the context at a given position in a Hurl document.
 */
export type HurlContext =
  | "method-line"
  | "request-header"
  | "request-section"
  | "response-status"
  | "response-section"
  | "body"
  | "section-content"
  | "unknown";

export interface ContextInfo {
  context: HurlContext;
  currentSection?: string;
  currentEntry?: HurlEntry;
  lineText: string;
}

function normalizeSectionName( rawSectionName: string ): string | undefined {
  return SECTION_ALIASES[ rawSectionName ];
}

function readPlaceholderVariableNames( text: string ): string[] {
  const names: string[] = [];
  const placeholderRegex = /\{\{\s*([^}]+?)\s*\}\}/g;
  let match: RegExpExecArray | null;

  while ( ( match = placeholderRegex.exec( text ) ) !== null ) {
    const expr = match[ 1 ].trim();
    if ( !expr ) {
      continue;
    }

    const firstToken = expr.split( "|" )[ 0 ].trim();
    if ( !firstToken ) {
      continue;
    }

    if ( TEMPLATE_FUNCTIONS.has( firstToken ) ) {
      continue;
    }

    if ( new RegExp( `^${VARIABLE_NAME_PATTERN}$` ).test( firstToken ) ) {
      names.push( firstToken );
    }
  }

  return names;
}

export function collectHurlVariableDefinitions( document: vscode.TextDocument ): HurlVariableDefinition[] {
  const variables: HurlVariableDefinition[] = [];
  let currentSection: string | undefined;

  for ( let i = 0; i < document.lineCount; i++ ) {
    const lineText = document.lineAt( i ).text;
    const trimmed = lineText.trim();

    if ( trimmed === "" || trimmed.startsWith( "#" ) ) {
      continue;
    }

    const sectionMatch = trimmed.match( /^\[([A-Za-z]+)\]/ );
    if ( sectionMatch ) {
      currentSection = normalizeSectionName( sectionMatch[ 1 ] );
      continue;
    }

    if ( currentSection === "Captures" ) {
      const captureMatch = trimmed.match( new RegExp( `^(${VARIABLE_NAME_PATTERN})\s*:` ) );
      if ( captureMatch ) {
        variables.push( {
          name: captureMatch[ 1 ],
          source: "capture",
          line: i,
        } );
      }
    }

    if ( currentSection === "Options" ) {
      const optionVariableMatch = trimmed.match( new RegExp( `^variable\s*:\s*(${VARIABLE_NAME_PATTERN})\s*=` ) );
      if ( optionVariableMatch ) {
        variables.push( {
          name: optionVariableMatch[ 1 ],
          source: "option-variable",
          line: i,
        } );
      }
    }

    const variableQueryMatches = trimmed.matchAll( new RegExp( `\bvariable\s+"(${VARIABLE_NAME_PATTERN})"`, "g" ) );
    for ( const variableQueryMatch of variableQueryMatches ) {
      variables.push( {
        name: variableQueryMatch[ 1 ],
        source: "variable-query",
        line: i,
      } );
    }

    for ( const placeholderName of readPlaceholderVariableNames( trimmed ) ) {
      variables.push( {
        name: placeholderName,
        source: "placeholder-usage",
        line: i,
      } );
    }
  }

  return variables;
}

export function getContextAtPosition(
  document: vscode.TextDocument,
  position: vscode.Position
): ContextInfo {
  const entries = parseHurlEntries( document );
  const line = position.line;
  const lineText = document.lineAt( line ).text;

  // Find which entry we're in
  let currentEntry: HurlEntry | undefined;
  for ( const entry of entries ) {
    if ( line >= entry.startLine && line <= entry.endLine ) {
      currentEntry = entry;
      break;
    }
  }

  // Empty line at start or before any entry
  if ( !currentEntry ) {
    if ( lineText.trim() === "" || lineText.startsWith( "#" ) ) {
      return { context: "method-line", lineText };
    }
    return { context: "unknown", lineText };
  }

  // On the method line itself
  if ( line === currentEntry.startLine ) {
    return { context: "method-line", currentEntry, lineText };
  }

  // Check if we've passed an HTTP status line (response section)
  let inResponse = false;
  let currentSection: string | undefined;

  for ( let i = currentEntry.startLine + 1; i <= line; i++ ) {
    const text = document.lineAt( i ).text.trimStart();
    if ( text.match( /^HTTP\s/ ) ) {
      inResponse = true;
      currentSection = undefined;
    }
    const sectionMatch = text.match( /^\[([A-Za-z]+)\]/ );
    if ( sectionMatch ) {
      currentSection = normalizeSectionName( sectionMatch[ 1 ] );
    }
  }

  // On an HTTP status line
  if ( lineText.trimStart().match( /^HTTP\s/ ) ) {
    return { context: "response-status", currentEntry, lineText };
  }

  // On a section header line
  if ( lineText.trimStart().match( /^\[/ ) ) {
    if ( inResponse ) {
      return { context: "response-section", currentEntry, lineText, currentSection };
    }
    return { context: "request-section", currentEntry, lineText, currentSection };
  }

  // Inside a section
  if ( currentSection ) {
    return { context: "section-content", currentEntry, lineText, currentSection };
  }

  // In request part (before HTTP status), looks like a header
  if ( !inResponse && lineText.match( /^\s*[\w-]+\s*:/ ) ) {
    return { context: "request-header", currentEntry, lineText };
  }

  if ( !inResponse ) {
    // Could be a header or body
    if ( lineText.trim() === "" || lineText.trim().startsWith( "{" ) || lineText.trim().startsWith( "<" ) ) {
      return { context: "body", currentEntry, lineText };
    }
    return { context: "request-header", currentEntry, lineText };
  }

  return { context: inResponse ? "response-section" : "unknown", currentEntry, lineText, currentSection };
}

/**
 * Checks if a string is a valid HTTP method.
 */
export function isValidMethod( method: string ): boolean {
  return METHOD_NAMES.includes( method.toUpperCase() );
}

/**
 * Basic URL validation.
 */
export function isValidUrl( url: string ): boolean {
  // Allow variables in URLs
  const urlWithoutVars = url.replace( /\{\{[^}]*\}\}/g, "placeholder" );
  return /^https?:\/\/.+/.test( urlWithoutVars ) || /^\{\{/.test( url );
}

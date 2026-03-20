import * as vscode from "vscode";
import { METHOD_NAMES } from "../data/methods";

export interface HurlEntry {
  method: string;
  url: string;
  startLine: number;
  endLine: number;
  entryIndex: number;
}

/**
 * Parses a Hurl document and returns all request entries.
 */
export function parseHurlEntries(document: vscode.TextDocument): HurlEntry[] {
  const entries: HurlEntry[] = [];
  const lineCount = document.lineCount;
  let entryIndex = 0;

  for (let i = 0; i < lineCount; i++) {
    const lineText = document.lineAt(i).text.trimStart();
    const match = lineText.match(
      /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|CONNECT|TRACE)\s+(.+)$/
    );
    if (match) {
      // Close the previous entry
      if (entries.length > 0) {
        entries[entries.length - 1].endLine = i - 1;
      }
      entries.push({
        method: match[1],
        url: match[2].trim(),
        startLine: i,
        endLine: lineCount - 1,
        entryIndex: entryIndex++,
      });
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

export function getContextAtPosition(
  document: vscode.TextDocument,
  position: vscode.Position
): ContextInfo {
  const entries = parseHurlEntries(document);
  const line = position.line;
  const lineText = document.lineAt(line).text;

  // Find which entry we're in
  let currentEntry: HurlEntry | undefined;
  for (const entry of entries) {
    if (line >= entry.startLine && line <= entry.endLine) {
      currentEntry = entry;
      break;
    }
  }

  // Empty line at start or before any entry
  if (!currentEntry) {
    if (lineText.trim() === "" || lineText.startsWith("#")) {
      return { context: "method-line", lineText };
    }
    return { context: "unknown", lineText };
  }

  // On the method line itself
  if (line === currentEntry.startLine) {
    return { context: "method-line", currentEntry, lineText };
  }

  // Check if we've passed an HTTP status line (response section)
  let inResponse = false;
  let currentSection: string | undefined;

  for (let i = currentEntry.startLine + 1; i <= line; i++) {
    const text = document.lineAt(i).text.trimStart();
    if (text.match(/^HTTP\s/)) {
      inResponse = true;
      currentSection = undefined;
    }
    const sectionMatch = text.match(/^\[(QueryStringParams|FormParams|MultipartFormData|Cookies|Options|Asserts|Captures|BasicAuth)\]/);
    if (sectionMatch) {
      currentSection = sectionMatch[1];
    }
  }

  // On an HTTP status line
  if (lineText.trimStart().match(/^HTTP\s/)) {
    return { context: "response-status", currentEntry, lineText };
  }

  // On a section header line
  if (lineText.trimStart().match(/^\[/)) {
    if (inResponse) {
      return { context: "response-section", currentEntry, lineText, currentSection };
    }
    return { context: "request-section", currentEntry, lineText, currentSection };
  }

  // Inside a section
  if (currentSection) {
    return { context: "section-content", currentEntry, lineText, currentSection };
  }

  // In request part (before HTTP status), looks like a header
  if (!inResponse && lineText.match(/^\s*[\w-]+\s*:/)) {
    return { context: "request-header", currentEntry, lineText };
  }

  if (!inResponse) {
    // Could be a header or body
    if (lineText.trim() === "" || lineText.trim().startsWith("{") || lineText.trim().startsWith("<")) {
      return { context: "body", currentEntry, lineText };
    }
    return { context: "request-header", currentEntry, lineText };
  }

  return { context: inResponse ? "response-section" : "unknown", currentEntry, lineText, currentSection };
}

/**
 * Checks if a string is a valid HTTP method.
 */
export function isValidMethod(method: string): boolean {
  return METHOD_NAMES.includes(method.toUpperCase());
}

/**
 * Basic URL validation.
 */
export function isValidUrl(url: string): boolean {
  // Allow variables in URLs
  const urlWithoutVars = url.replace(/\{\{[^}]*\}\}/g, "placeholder");
  return /^https?:\/\/.+/.test(urlWithoutVars) || /^\{\{/.test(url);
}

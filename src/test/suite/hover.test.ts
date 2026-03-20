import * as assert from "assert";
import * as vscode from "vscode";
import { openDocument, sleep } from "./helpers";

async function getHover(
  doc: vscode.TextDocument,
  position: vscode.Position
): Promise<vscode.Hover[]> {
  return await vscode.commands.executeCommand<vscode.Hover[]>(
    "vscode.executeHoverProvider",
    doc.uri,
    position
  );
}

function hoverContains(hovers: vscode.Hover[], text: string): boolean {
  for (const hover of hovers) {
    for (const content of hover.contents) {
      if (typeof content === "string") {
        if (content.includes(text)) return true;
      } else if (content instanceof vscode.MarkdownString) {
        if (content.value.includes(text)) return true;
      } else if ("value" in content) {
        if ((content as { value: string }).value.includes(text)) return true;
      }
    }
  }
  return false;
}

suite("Hover Provider", () => {
  let doc: vscode.TextDocument;

  suiteSetup(async () => {
    doc = await openDocument("test.hurl");
    await sleep(2000);
  });

  suiteTeardown(async () => {
    await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
  });

  test("HTTP method GET shows description on hover", async () => {
    // Line 1: "GET http://localhost:8080/api/users/1"
    const hovers = await getHover(doc, new vscode.Position(1, 1));
    assert.ok(hovers.length > 0, "Should have hover for GET");
    assert.ok(hoverContains(hovers, "GET"), "Hover should mention GET");
  });

  test("HTTP method POST shows description on hover", async () => {
    // File line 17, 0-indexed = 16: "POST http://localhost:8080/api/users"
    const hovers = await getHover(doc, new vscode.Position(16, 1));
    assert.ok(hovers.length > 0, "Should have hover for POST");
    assert.ok(hoverContains(hovers, "POST"), "Hover should mention POST");
  });

  test("Status code 200 shows OK on hover", async () => {
    // File line 8, 0-indexed = 7: "HTTP 200"
    const hovers = await getHover(doc, new vscode.Position(7, 6));
    assert.ok(hovers.length > 0, "Should have hover for status code 200");
    assert.ok(hoverContains(hovers, "200"), "Hover should mention 200");
    assert.ok(hoverContains(hovers, "OK"), "Hover should mention OK");
  });

  test("Status code 201 shows Created on hover", async () => {
    // File line 24, 0-indexed = 23: "HTTP 201"
    const hovers = await getHover(doc, new vscode.Position(23, 6));
    assert.ok(hovers.length > 0, "Should have hover for status code 201");
    assert.ok(hoverContains(hovers, "201"), "Hover should mention 201");
    assert.ok(hoverContains(hovers, "Created"), "Hover should mention Created");
  });

  test("Section [Asserts] shows description on hover", async () => {
    // File line 9, 0-indexed = 8: "[Asserts]"
    const hovers = await getHover(doc, new vscode.Position(8, 3));
    assert.ok(hovers.length > 0, "Should have hover for [Asserts]");
    assert.ok(hoverContains(hovers, "Asserts"), "Hover should mention Asserts");
  });

  test("Section [Options] shows description on hover", async () => {
    // Line 3: "[Options]"
    const hovers = await getHover(doc, new vscode.Position(3, 3));
    assert.ok(hovers.length > 0, "Should have hover for [Options]");
    assert.ok(hoverContains(hovers, "Options"), "Hover should mention Options");
  });

  test("Assert predicate 'contains' shows hover", async () => {
    // File line 10, 0-indexed = 9: 'header "Content-Type" contains "application/json"'
    const hovers = await getHover(doc, new vscode.Position(9, 25));
    assert.ok(hovers.length > 0, "Should have hover for contains predicate");
    assert.ok(hoverContains(hovers, "contains"), "Hover should mention contains");
  });

  test("Comment line shows no meaningful hover", async () => {
    // Line 0: "# Test getting a user"
    const hovers = await getHover(doc, new vscode.Position(0, 5));
    // Hovers on comments should either be empty or not contain method/status info
    const hasMethodInfo = hoverContains(hovers, "HTTP Method");
    assert.ok(!hasMethodInfo, "Comment should not show HTTP method hover");
  });
});

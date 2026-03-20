import * as assert from "assert";
import * as vscode from "vscode";
import { openDocument, sleep } from "./helpers";

suite("CodeLens Provider", () => {
  let doc: vscode.TextDocument;

  suiteSetup(async () => {
    doc = await openDocument("test.hurl");
    await sleep(2000);
  });

  suiteTeardown(async () => {
    await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
  });

  test("CodeLens entries exist for request lines", async () => {
    const lenses = await vscode.commands.executeCommand<vscode.CodeLens[]>(
      "vscode.executeCodeLensProvider",
      doc.uri
    );
    assert.ok(lenses, "Should return CodeLens array");
    assert.ok(lenses!.length > 0, "Should have at least one CodeLens");
  });

  test("Each request has a Run Request CodeLens", async () => {
    const lenses = await vscode.commands.executeCommand<vscode.CodeLens[]>(
      "vscode.executeCodeLensProvider",
      doc.uri
    );
    assert.ok(lenses, "Should return CodeLens array");
    const runLenses = lenses!.filter(
      (l) => l.command && l.command.title.includes("Run Request")
    );
    // test.hurl has 4 requests: GET, POST, GET (404), DELETE
    assert.ok(
      runLenses.length >= 4,
      `Expected at least 4 Run Request lenses, got ${runLenses.length}`
    );
  });

  test("First request has a Run All CodeLens", async () => {
    const lenses = await vscode.commands.executeCommand<vscode.CodeLens[]>(
      "vscode.executeCodeLensProvider",
      doc.uri
    );
    assert.ok(lenses, "Should return CodeLens array");
    const runAllLenses = lenses!.filter(
      (l) => l.command && l.command.title.includes("Run All")
    );
    assert.strictEqual(
      runAllLenses.length,
      1,
      "Should have exactly one Run All CodeLens"
    );
  });

  test("Run Request CodeLens has correct command", async () => {
    const lenses = await vscode.commands.executeCommand<vscode.CodeLens[]>(
      "vscode.executeCodeLensProvider",
      doc.uri
    );
    assert.ok(lenses, "Should return CodeLens array");
    const runLens = lenses!.find(
      (l) => l.command && l.command.title.includes("Run Request")
    );
    assert.ok(runLens, "Should have a Run Request lens");
    assert.strictEqual(runLens!.command!.command, "hurl-toolkit.runEntry");
  });

  test("CodeLens appears at request method lines", async () => {
    const lenses = await vscode.commands.executeCommand<vscode.CodeLens[]>(
      "vscode.executeCodeLensProvider",
      doc.uri
    );
    assert.ok(lenses, "Should return CodeLens array");
    // All lenses should be at lines that have HTTP methods
    for (const lens of lenses!) {
      const line = doc.lineAt(lens.range.start.line).text.trimStart();
      assert.ok(
        line.match(/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|CONNECT|TRACE)\s/),
        `CodeLens at line ${lens.range.start.line} should be on a method line, but got: "${line}"`
      );
    }
  });

  test("Multiple requests produce multiple CodeLens entries", async () => {
    const lenses = await vscode.commands.executeCommand<vscode.CodeLens[]>(
      "vscode.executeCodeLensProvider",
      doc.uri
    );
    assert.ok(lenses, "Should return CodeLens array");
    // 4 requests: each gets "Run Request", first also gets "Run All" = 5 total
    assert.ok(
      lenses!.length >= 5,
      `Expected at least 5 total CodeLens entries, got ${lenses!.length}`
    );
  });
});

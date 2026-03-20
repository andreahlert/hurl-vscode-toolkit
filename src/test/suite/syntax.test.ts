import * as assert from "assert";
import * as vscode from "vscode";
import { openDocument, sleep } from "./helpers";

suite("Syntax / Language Registration", () => {
  test("Language 'hurl' is registered", () => {
    const languages = vscode.languages.getLanguages();
    return languages.then((langs) => {
      assert.ok(langs.includes("hurl"), "Expected 'hurl' in registered languages");
    });
  });

  test(".hurl files are detected as hurl language", async () => {
    const doc = await openDocument("test.hurl");
    assert.strictEqual(doc.languageId, "hurl");
  });

  test(".hurl file can be opened and has content", async () => {
    const doc = await openDocument("test.hurl");
    assert.ok(doc.lineCount > 0, "Document should have lines");
    assert.ok(doc.getText().includes("GET"), "Document should contain GET");
  });
});

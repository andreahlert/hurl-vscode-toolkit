import * as assert from "assert";
import * as vscode from "vscode";
import { openDocument, sleep } from "./helpers";

function getDiagnostics(uri: vscode.Uri): vscode.Diagnostic[] {
  return vscode.languages.getDiagnostics(uri);
}

suite("Diagnostics Provider", () => {
  test("Valid .hurl file has zero diagnostics", async () => {
    const doc = await openDocument("test.hurl");
    await sleep(2000);
    const diags = getDiagnostics(doc.uri);
    assert.strictEqual(diags.length, 0, `Expected 0 diagnostics but got ${diags.length}: ${diags.map(d => d.message).join(", ")}`);
  });

  test("Invalid file reports diagnostics for all error types", async () => {
    const doc = await openDocument("invalid.hurl");
    await sleep(2000);
    const diags = getDiagnostics(doc.uri);

    // Should have multiple diagnostics
    assert.ok(diags.length > 0, "Should have at least one diagnostic");

    // Invalid HTTP method
    const methodDiag = diags.find((d) => d.message.includes("Unknown HTTP method"));
    assert.ok(methodDiag, "Should flag INVALID as unknown HTTP method");
    assert.strictEqual(methodDiag!.severity, vscode.DiagnosticSeverity.Error);

    // Unknown section name
    const sectionDiag = diags.find((d) => d.message.includes("Unknown section"));
    assert.ok(sectionDiag, "Should flag [UnknownSection] as unknown section");
    assert.strictEqual(sectionDiag!.severity, vscode.DiagnosticSeverity.Error);

    // Unclosed variable
    const varDiag = diags.find((d) => d.message.includes("Unclosed variable"));
    assert.ok(varDiag, "Should flag unclosed {{ variable");
    assert.strictEqual(varDiag!.severity, vscode.DiagnosticSeverity.Error);

    // Invalid URL
    const urlDiag = diags.find((d) => d.message.includes("URL should start with"));
    assert.ok(urlDiag, "Should flag malformed URL");
    assert.strictEqual(urlDiag!.severity, vscode.DiagnosticSeverity.Warning);

    // Out-of-range status code
    const statusDiag = diags.find((d) => d.message.includes("Invalid HTTP status code"));
    assert.ok(statusDiag, "Should flag HTTP 999 as invalid status");
    assert.strictEqual(statusDiag!.severity, vscode.DiagnosticSeverity.Error);
  });
});

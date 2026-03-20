import * as assert from "assert";
import * as vscode from "vscode";
import * as path from "path";
import { sleep, FIXTURES_PATH } from "./helpers";

async function getCompletions(
  doc: vscode.TextDocument,
  position: vscode.Position
): Promise<vscode.CompletionList> {
  return await vscode.commands.executeCommand<vscode.CompletionList>(
    "vscode.executeCompletionItemProvider",
    doc.uri,
    position
  );
}

function hasLabel(list: vscode.CompletionList, label: string): boolean {
  return list.items.some((item) => {
    if (typeof item.label === "string") {
      return item.label === label;
    }
    return (item.label as vscode.CompletionItemLabel).label === label;
  });
}

suite("Completion Provider", () => {
  let doc: vscode.TextDocument;

  suiteSetup(async () => {
    // Create a temporary hurl file for completion testing
    const content = [
      "",                                    // line 0: empty, for method completions
      "GET http://localhost:8080/api/users",  // line 1: method line
      "",                                    // line 2: after method, for header completions
      "Content-Type: ",                      // line 3: header value context
      "",                                    // line 4
      "HTTP ",                               // line 5: status code completions
      "[",                                   // line 6: section completions
      "[Asserts]",                           // line 7: asserts section
      "",                                    // line 8: inside asserts, for predicates
      'jsonpath "$.name" ',                  // line 9: after query, for predicates
      "[Options]",                           // line 10: options section
      "",                                    // line 11: inside options
      "[Captures]",                          // line 12: captures section
      "user_id: ",                           // line 13: capture query
      "{{",                                  // line 14: variable
    ].join("\n");

    const uri = vscode.Uri.file(path.join(FIXTURES_PATH, "completion-test.hurl"));
    const wsEdit = new vscode.WorkspaceEdit();
    wsEdit.createFile(uri, { overwrite: true });
    await vscode.workspace.applyEdit(wsEdit);

    const wsEdit2 = new vscode.WorkspaceEdit();
    wsEdit2.insert(uri, new vscode.Position(0, 0), content);
    await vscode.workspace.applyEdit(wsEdit2);

    doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc);
    await sleep(2000);
  });

  suiteTeardown(async () => {
    await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
    // Clean up the temp file
    try {
      const uri = vscode.Uri.file(path.join(FIXTURES_PATH, "completion-test.hurl"));
      await vscode.workspace.fs.delete(uri);
    } catch {
      // ignore
    }
  });

  test("HTTP methods at empty line start", async () => {
    const completions = await getCompletions(doc, new vscode.Position(0, 0));
    assert.ok(hasLabel(completions, "GET"), "Should suggest GET");
    assert.ok(hasLabel(completions, "POST"), "Should suggest POST");
    assert.ok(hasLabel(completions, "PUT"), "Should suggest PUT");
    assert.ok(hasLabel(completions, "DELETE"), "Should suggest DELETE");
    assert.ok(hasLabel(completions, "PATCH"), "Should suggest PATCH");
    assert.ok(hasLabel(completions, "HEAD"), "Should suggest HEAD");
    assert.ok(hasLabel(completions, "OPTIONS"), "Should suggest OPTIONS");
  });

  test("Method completions include descriptions", async () => {
    const completions = await getCompletions(doc, new vscode.Position(0, 0));
    const getItem = completions.items.find((item) => {
      const label = typeof item.label === "string" ? item.label : (item.label as vscode.CompletionItemLabel).label;
      return label === "GET";
    });
    assert.ok(getItem, "GET completion should exist");
    assert.ok(getItem!.detail, "GET should have detail/description");
  });

  test("Status codes after HTTP keyword", async () => {
    const completions = await getCompletions(doc, new vscode.Position(5, 5));
    assert.ok(hasLabel(completions, "200"), "Should suggest 200");
    assert.ok(hasLabel(completions, "201"), "Should suggest 201");
    assert.ok(hasLabel(completions, "404"), "Should suggest 404");
    assert.ok(hasLabel(completions, "500"), "Should suggest 500");
  });

  test("Status code completions include documentation", async () => {
    const completions = await getCompletions(doc, new vscode.Position(5, 5));
    const item200 = completions.items.find((item) => {
      const label = typeof item.label === "string" ? item.label : (item.label as vscode.CompletionItemLabel).label;
      return label === "200";
    });
    assert.ok(item200, "200 completion should exist");
    assert.ok(item200!.detail, "200 should have detail");
    assert.ok(
      item200!.detail!.includes("OK") || item200!.detail!.includes("200"),
      "200 detail should mention OK or 200"
    );
  });

  test("Section names when typing [", async () => {
    const completions = await getCompletions(doc, new vscode.Position(6, 1));
    assert.ok(hasLabel(completions, "[Asserts]"), "Should suggest [Asserts]");
    assert.ok(hasLabel(completions, "[Captures]"), "Should suggest [Captures]");
    assert.ok(hasLabel(completions, "[Options]"), "Should suggest [Options]");
    assert.ok(hasLabel(completions, "[QueryStringParams]"), "Should suggest [QueryStringParams]");
    assert.ok(hasLabel(completions, "[FormParams]"), "Should suggest [FormParams]");
    assert.ok(hasLabel(completions, "[BasicAuth]"), "Should suggest [BasicAuth]");
  });

  test("Section completions include documentation", async () => {
    const completions = await getCompletions(doc, new vscode.Position(6, 1));
    const assertsItem = completions.items.find((item) => {
      const label = typeof item.label === "string" ? item.label : (item.label as vscode.CompletionItemLabel).label;
      return label === "[Asserts]";
    });
    assert.ok(assertsItem, "[Asserts] completion should exist");
    assert.ok(assertsItem!.documentation, "[Asserts] should have documentation");
  });

  test("Assert predicates after jsonpath query", async () => {
    const completions = await getCompletions(doc, new vscode.Position(9, 20));
    // Check for common predicates
    assert.ok(hasLabel(completions, "=="), "Should suggest ==");
    assert.ok(hasLabel(completions, "!="), "Should suggest !=");
    assert.ok(hasLabel(completions, "contains"), "Should suggest contains");
    assert.ok(hasLabel(completions, "exists"), "Should suggest exists");
    assert.ok(hasLabel(completions, "matches"), "Should suggest matches");
  });

  test("Options inside [Options] section", async () => {
    const completions = await getCompletions(doc, new vscode.Position(11, 0));
    assert.ok(hasLabel(completions, "retry"), "Should suggest retry");
    assert.ok(hasLabel(completions, "delay"), "Should suggest delay");
    assert.ok(hasLabel(completions, "location"), "Should suggest location");
    assert.ok(hasLabel(completions, "verbose"), "Should suggest verbose");
  });
});

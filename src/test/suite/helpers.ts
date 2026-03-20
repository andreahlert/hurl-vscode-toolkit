import * as vscode from "vscode";
import * as path from "path";

export const FIXTURES_PATH = path.resolve(__dirname, "../../../test-fixtures");

export async function openDocument(filename: string): Promise<vscode.TextDocument> {
  const uri = vscode.Uri.file(path.join(FIXTURES_PATH, filename));
  const doc = await vscode.workspace.openTextDocument(uri);
  await vscode.window.showTextDocument(doc);
  return doc;
}

export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wait for the extension to activate on a .hurl file and providers to be ready.
 */
export async function activateExtension(): Promise<void> {
  const doc = await openDocument("test.hurl");
  // Wait for extension activation and providers to register
  await sleep(2000);
  await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
  await sleep(500);
}

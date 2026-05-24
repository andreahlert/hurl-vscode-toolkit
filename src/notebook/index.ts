import * as vscode from "vscode";
import { HurlNotebookSerializer } from "./HurlNotebookSerializer";
import { HurlNotebookController } from "./HurlNotebookController";
import { HurlEnvironmentManager } from "../utils/environmentManager";

export { HURL_NOTEBOOK_TYPE } from "./HurlNotebookController";
export { hurlTextToCells, cellsToHurlText } from "./HurlNotebookSerializer";

export function activateHurlNotebook(
  context: vscode.ExtensionContext,
  environmentManager: HurlEnvironmentManager
): void {
  const serializer = new HurlNotebookSerializer();
  new HurlNotebookController( context, environmentManager );

  context.subscriptions.push(
    vscode.workspace.registerNotebookSerializer( "hurl-notebook", serializer )
  );
}

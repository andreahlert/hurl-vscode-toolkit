import * as vscode from "vscode";
import { HurlCompletionProvider } from "./providers/completionProvider";
import { HurlHoverProvider } from "./providers/hoverProvider";
import { HurlDiagnosticProvider } from "./providers/diagnosticProvider";
import {
  HurlCodeLensProvider,
  createRunEntryCommand,
  createRunFileCommand,
} from "./providers/codeLensProvider";
import { HurlEnvironmentManager } from "./utils/environmentManager";

const HURL_SELECTOR: vscode.DocumentSelector = [
  { language: "hurl", scheme: "file" },
  { language: "hurl", scheme: "vscode-notebook-cell" },
];

export function activate( context: vscode.ExtensionContext ): void {
  const outputChannel = vscode.window.createOutputChannel( "Hurl Toolkit" );
  const environmentManager = new HurlEnvironmentManager( context );
  const environmentStatusBarItem = vscode.window.createStatusBarItem( vscode.StatusBarAlignment.Left, 100 );

  const updateEnvironmentStatusBar = () => {
    environmentStatusBarItem.text = `Hurl: ${environmentManager.getActiveEnvironmentLabel()}`;
    environmentStatusBarItem.tooltip = "Select the active Hurl environment profile";
    environmentStatusBarItem.command = "hurl-toolkit.selectEnvironment";
    environmentStatusBarItem.show();
  };

  updateEnvironmentStatusBar();

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration( ( event ) => {
      if ( event.affectsConfiguration( "hurl-toolkit" ) ) {
        updateEnvironmentStatusBar();
      }
    } )
  );

  // Completion provider
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      HURL_SELECTOR,
      new HurlCompletionProvider(),
      "[", // trigger for sections
      "{", // trigger for variables
      ":", // trigger for header values
      " "  // trigger after method, etc.
    )
    ,
    vscode.languages.registerHoverProvider( HURL_SELECTOR, new HurlHoverProvider() )
  );

  // Diagnostics
  const diagnosticCollection = vscode.languages.createDiagnosticCollection( "hurl" );
  const diagnosticProvider = new HurlDiagnosticProvider( diagnosticCollection );
  context.subscriptions.push( diagnosticCollection );

  // Update diagnostics on open, change, and save
  if ( vscode.window.activeTextEditor?.document.languageId === "hurl" ) {
    diagnosticProvider.updateDiagnostics( vscode.window.activeTextEditor.document );
  }

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument( ( doc ) => {
      if ( doc.languageId === "hurl" ) {
        diagnosticProvider.updateDiagnostics( doc );
      }
    } )
    ,
    vscode.workspace.onDidChangeTextDocument( ( event ) => {
      if ( event.document.languageId === "hurl" ) {
        diagnosticProvider.updateDiagnostics( event.document );
      }
    } )
    ,
    vscode.workspace.onDidCloseTextDocument( ( doc ) => {
      diagnosticCollection.delete( doc.uri );
    } )
    ,
    vscode.languages.registerCodeLensProvider( HURL_SELECTOR, new HurlCodeLensProvider() )
    ,
    vscode.commands.registerCommand(
      "hurl-toolkit.runEntry",
      createRunEntryCommand( outputChannel, environmentManager )
    )
    ,
    vscode.commands.registerCommand(
      "hurl-toolkit.runFile",
      createRunFileCommand( outputChannel, environmentManager )
    )
    ,
    vscode.commands.registerCommand(
      "hurl-toolkit.selectEnvironment",
      async () => {
        await environmentManager.selectEnvironment();
        updateEnvironmentStatusBar();
      }
    )
    ,
    vscode.commands.registerCommand(
      "hurl-toolkit.clearEnvironment",
      async () => {
        await environmentManager.clearEnvironment();
        updateEnvironmentStatusBar();
      }
    )
    , outputChannel );

  context.subscriptions.push( environmentStatusBarItem );
}

export function deactivate(): void {
  // Nothing to clean up
}

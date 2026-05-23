import * as vscode from "vscode";
import { HurlCompletionProvider } from "./providers/completionProvider";
import { HurlHoverProvider } from "./providers/hoverProvider";
import { HurlDiagnosticProvider } from "./providers/diagnosticProvider";
import {
  HurlCodeLensProvider,
  createRunEntryCommand,
  createRunFileCommand,
} from "./providers/codeLensProvider";

const HURL_SELECTOR: vscode.DocumentSelector = { language: "hurl", scheme: "file" };

export function activate( context: vscode.ExtensionContext ): void {
  const outputChannel = vscode.window.createOutputChannel( "Hurl Toolkit" );

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
      createRunEntryCommand( outputChannel )
    )
    ,
    vscode.commands.registerCommand(
      "hurl-toolkit.runFile",
      createRunFileCommand( outputChannel )
    )
    , outputChannel );
}

export function deactivate(): void {
  // Nothing to clean up
}

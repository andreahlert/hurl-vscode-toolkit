import * as vscode from "vscode";
import { HurlCompletionProvider } from "./providers/completionProvider";
import { GraphQLCompletionProvider } from "./providers/graphql.completion";
import { HurlHoverProvider } from "./providers/hoverProvider";
import { HurlDiagnosticProvider } from "./providers/diagnosticProvider";
import {
  HurlCodeLensProvider,
  createRunEntryCommand,
  createRunFileCommand,
} from "./providers/codeLensProvider";
import { HurlEnvironmentManager } from "./utils/environmentManager";
import { activateHurlNotebook, HURL_NOTEBOOK_TYPE } from "./notebook/index";

type PickItem = vscode.QuickPickItem & { value: string };

async function pickTargetProfile(
  environmentManager: HurlEnvironmentManager,
  profileNames: string[],
  activeProfileName: string
): Promise<string | undefined> {
  if ( profileNames.length === 0 ) {
    const newName = await vscode.window.showInputBox( {
      title: "Create Environment Profile",
      prompt: "No profiles exist yet. Enter a name for your new environment profile",
      value: "default",
      validateInput: ( v ) => v.trim() ? null : "Profile name cannot be empty",
    } );
    return newName?.trim() || undefined;
  }

  const choices: PickItem[] = [
    ...( activeProfileName ? [ { label: activeProfileName, description: "$(check) Active profile", value: activeProfileName } ] : [] ),
    ...profileNames.filter( p => p !== activeProfileName ).map( p => ( { label: p, description: "", value: p } ) ),
    { label: "$(add) Create new profile...", description: "", value: "__new__" },
  ];

  const selection = await vscode.window.showQuickPick( choices, {
    title: "Save to Profile",
    placeHolder: "Select the environment profile to store this variable in",
  } );
  if ( !selection ) return undefined;

  if ( selection.value !== "__new__" ) return selection.value;

  const newName = await vscode.window.showInputBox( {
    prompt: "New profile name",
    placeHolder: "e.g. dev, staging, prod",
    validateInput: ( v ) => v.trim() ? null : "Profile name cannot be empty",
  } );
  return newName?.trim() || undefined;
}

async function applyVariableAction(
  environmentManager: HurlEnvironmentManager,
  selectedProfile: string,
  variables: Record<string, string>,
  variableName: string,
  action: string
): Promise<void> {
  if ( action === "edit" ) {
    const newValue = await vscode.window.showInputBox( {
      prompt: `New value for ${variableName}`,
      password: true,
      validateInput: ( v ) => v.trim() ? null : "Value cannot be empty",
    } );
    if ( newValue === undefined ) return;
    await environmentManager.saveVariableToProfile( selectedProfile, variableName, newValue.trim() );
    void vscode.window.showInformationMessage( `Variable "${variableName}" updated.` );
  } else if ( action === "copy" ) {
    await vscode.env.clipboard.writeText( variables[ variableName ] );
    void vscode.window.showInformationMessage( `Value of "${variableName}" copied to clipboard.` );
  } else if ( action === "delete" ) {
    const confirm = await vscode.window.showWarningMessage(
      `Delete variable "${variableName}" from profile "${selectedProfile}"?`,
      { modal: true },
      "Delete"
    );
    if ( confirm === "Delete" ) {
      await environmentManager.removeVariableFromProfile( selectedProfile, variableName );
      void vscode.window.showInformationMessage( `Variable "${variableName}" deleted.` );
    }
  }
}

const HURL_SELECTOR: vscode.DocumentSelector = [
  { language: "hurl", scheme: "file" },
  { language: "hurl", scheme: "vscode-notebook-cell" },
];

export function activate( context: vscode.ExtensionContext ): void {
  const outputChannel = vscode.window.createOutputChannel( "Hurl Toolkit" );
  const environmentManager = new HurlEnvironmentManager( context );
  const environmentStatusBarItem = vscode.window.createStatusBarItem( vscode.StatusBarAlignment.Left, 100 );
  const graphqlProvider = new GraphQLCompletionProvider();

  activateHurlNotebook( context, environmentManager );

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
    ,
    vscode.languages.registerCompletionItemProvider(
      HURL_SELECTOR,
      new HurlCompletionProvider( graphqlProvider ),
      "[", // trigger for sections
      "{", // trigger for variables
      ":", // trigger for header values
      "("  // trigger for GraphQL argument completions
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
      "hurl-toolkit.runEntryFocused",
      createRunEntryCommand( outputChannel, environmentManager, true )
    )
    ,
    vscode.commands.registerCommand(
      "hurl-toolkit.runFile",
      createRunFileCommand( outputChannel, environmentManager )
    )
    ,
    vscode.commands.registerCommand(
      "hurl-toolkit.runFileFocused",
      createRunFileCommand( outputChannel, environmentManager, true )
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
    ,
    vscode.commands.registerCommand(
      "hurl-toolkit.fetchGraphQLSchema",
      async () => {
        const editor = vscode.window.activeTextEditor;
        if ( editor?.document.languageId !== "hurl" ) {
          vscode.window.showErrorMessage( "Hurl Toolkit: Open a .hurl file and place the cursor inside a ```graphql block." );
          return;
        }
        await graphqlProvider.fetchAndCacheSchemaForDocument( editor.document, editor.selection.active );
      }
    )
    ,
    vscode.commands.registerCommand(
      "hurl-toolkit.addAuthToken",
      async () => {
        const AUTH_TYPES = [
          { label: "Bearer Token", detail: "Authorization: Bearer {{variable_name}}", suggestedName: "bearer_token", prefix: "Bearer " },
          { label: "Basic Auth", detail: "Authorization: Basic {{variable_name}}", suggestedName: "basic_credentials", prefix: "Basic " },
          { label: "API Key", detail: "Used as {{variable_name}} in headers or query params", suggestedName: "api_key", prefix: "" },
          { label: "Custom Token", detail: "Choose your own variable name", suggestedName: "token", prefix: "" },
        ];

        const authType = await vscode.window.showQuickPick( AUTH_TYPES, {
          title: "Add Auth Token (1/3) — Type",
          placeHolder: "Select the authentication scheme",
          matchOnDetail: true,
        } );
        if ( !authType ) return;

        const variableName = await vscode.window.showInputBox( {
          title: "Add Auth Token (2/3) — Variable Name",
          prompt: "Name for this variable (referenced as {{name}} in .hurl files)",
          value: authType.suggestedName,
          validateInput: ( v ) => {
            const trimmed = v.trim();
            if ( !trimmed ) return "Variable name is required";
            if ( !/^\w+$/.test( trimmed ) ) return "Only letters, digits, and underscores are allowed";
            return null;
          },
        } );
        if ( !variableName ) return;

        const tokenValue = await vscode.window.showInputBox( {
          title: "Add Auth Token (3/3) — Value",
          prompt: `Token value for ${authType.label}`,
          password: true,
          placeHolder: authType.label === "Bearer Token" ? "eyJhbGciOiJIUzI1NiJ9..." : "your-token-value",
          validateInput: ( v ) => v.trim() ? null : "Token value is required",
        } );
        if ( !tokenValue?.trim() ) return;

        const profileNames = Object.keys( environmentManager.getProfiles() );
        const activeProfileName = environmentManager.getActiveEnvironmentName();
        const targetProfile = await pickTargetProfile( environmentManager, profileNames, activeProfileName );
        if ( !targetProfile ) return;

        await environmentManager.saveVariableToProfile( targetProfile, variableName.trim(), tokenValue.trim() );

        if ( !activeProfileName && !profileNames.includes( targetProfile ) ) {
          await environmentManager.setActiveEnvironment( targetProfile );
          updateEnvironmentStatusBar();
        }

        const usageHint = authType.prefix
          ? `Authorization: ${authType.prefix}{{${variableName.trim()}}}`
          : `{{${variableName.trim()}}}`;

        void vscode.window.showInformationMessage(
          `Variable "{{${variableName.trim()}}}" saved to profile "${targetProfile}". Use it as: ${usageHint}`
        );
      }
    )
    ,
    vscode.commands.registerCommand(
      "hurl-toolkit.openAsNotebook",
      async ( uri?: vscode.Uri ) => {
        const targetUri = uri ?? vscode.window.activeTextEditor?.document.uri;
        if ( !targetUri?.fsPath.endsWith( ".hurl" ) ) {
          vscode.window.showErrorMessage( "Hurl Toolkit: Open a .hurl file first." );
          return;
        }
        await vscode.commands.executeCommand( "vscode.openWith", targetUri, HURL_NOTEBOOK_TYPE );
      }
    )
    ,
    vscode.commands.registerCommand(
      "hurl-toolkit.manageVariables",
      async () => {
        const profiles = environmentManager.getProfiles();
        const profileNames = Object.keys( profiles );

        if ( profileNames.length === 0 ) {
          const add = await vscode.window.showInformationMessage(
            "No environment profiles found. Would you like to add an auth token?",
            "Add Auth Token"
          );
          if ( add ) await vscode.commands.executeCommand( "hurl-toolkit.addAuthToken" );
          return;
        }

        const activeProfileName = environmentManager.getActiveEnvironmentName();
        let selectedProfile: string;

        if ( profileNames.length === 1 ) {
          selectedProfile = profileNames[ 0 ];
        } else {
          const profileChoices: PickItem[] = profileNames.map( p => ( {
            label: p,
            description: p === activeProfileName ? "$(check) Active" : "",
            value: p,
          } ) );
          const picked = await vscode.window.showQuickPick( profileChoices, {
            title: "Manage Variables — Select Profile",
            placeHolder: "Which profile's variables do you want to manage?",
          } );
          if ( !picked ) return;
          selectedProfile = picked.value;
        }

        const variables = profiles[ selectedProfile ].variables ?? {};
        const varNames = Object.keys( variables );

        if ( varNames.length === 0 ) {
          const add = await vscode.window.showInformationMessage(
            `Profile "${selectedProfile}" has no variables. Add an auth token?`,
            "Add Auth Token"
          );
          if ( add ) await vscode.commands.executeCommand( "hurl-toolkit.addAuthToken" );
          return;
        }

        const maskValue = ( v: string ) =>
          v.length > 4 ? `${v.slice( 0, 4 )}${"*".repeat( Math.min( v.length - 4, 8 ) )}` : "****";

        const varChoices: PickItem[] = [
          ...varNames.map( name => ( { label: `$(symbol-variable) ${name}`, description: maskValue( variables[ name ] ), value: name } ) ),
          { label: "$(add) Add new variable...", description: "", value: "__add__" },
        ];

        const selected = await vscode.window.showQuickPick( varChoices, {
          title: `Manage Variables — ${selectedProfile}`,
          placeHolder: "Select a variable to manage",
        } );
        if ( !selected ) return;

        if ( selected.value === "__add__" ) {
          await vscode.commands.executeCommand( "hurl-toolkit.addAuthToken" );
          return;
        }

        const action = await vscode.window.showQuickPick<PickItem>(
          [
            { label: "$(edit) Edit value", value: "edit" },
            { label: "$(copy) Copy value to clipboard", value: "copy" },
            { label: "$(trash) Delete variable", value: "delete" },
          ],
          { title: `Variable: ${selected.value}`, placeHolder: "What would you like to do?" }
        );
        if ( !action ) return;

        await applyVariableAction( environmentManager, selectedProfile, variables, selected.value, action.value );
      }
    )
    , outputChannel, environmentStatusBarItem );
}

export function deactivate(): void {
  // Nothing to clean up
}

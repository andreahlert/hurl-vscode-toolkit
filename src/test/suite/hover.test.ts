import * as assert from "assert";
import * as vscode from "vscode";
import * as path from "path";
import { FIXTURES_PATH, sleep } from "./helpers";

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

function hoverContains( hovers: vscode.Hover[], text: string ): boolean {
  for ( const hover of hovers ) {
    for ( const content of hover.contents ) {
      if ( typeof content === "string" ) {
        if ( content.includes( text ) ) return true;
      } else if ( content instanceof vscode.MarkdownString ) {
        if ( content.value.includes( text ) ) return true;
      } else if ( "value" in content ) {
        if ( ( content as { value: string } ).value.includes( text ) ) return true;
      }
    }
  }
  return false;
}

suite( "Hover Provider", () => {
  let doc: vscode.TextDocument;

  suiteSetup( async () => {
    const content = [
      "GET https://example.org/api/users/1",
      "HTTP 200",
      "[Options]",
      "variable: host=example.org",
      "[Captures]",
      'user_id: jsonpath "$.id"',
      "[Asserts]",
      'jsonpath "$.id" == {{user_id}}',
      'header "Content-Type" contains "application/json"',
    ].join( "\n" );

    const uri = vscode.Uri.file( path.join( FIXTURES_PATH, "hover-test.hurl" ) );
    const wsEdit = new vscode.WorkspaceEdit();
    wsEdit.createFile( uri, { overwrite: true } );
    await vscode.workspace.applyEdit( wsEdit );

    const wsEdit2 = new vscode.WorkspaceEdit();
    wsEdit2.insert( uri, new vscode.Position( 0, 0 ), content );
    await vscode.workspace.applyEdit( wsEdit2 );

    doc = await vscode.workspace.openTextDocument( uri );
    await vscode.window.showTextDocument( doc );
    await sleep( 2000 );
  } );

  suiteTeardown( async () => {
    await vscode.commands.executeCommand( "workbench.action.closeActiveEditor" );
    try {
      const uri = vscode.Uri.file( path.join( FIXTURES_PATH, "hover-test.hurl" ) );
      await vscode.workspace.fs.delete( uri );
    } catch {
      // ignore
    }
  } );

  test( "HTTP method GET shows description on hover", async () => {
    const hovers = await getHover( doc, new vscode.Position( 0, 1 ) );
    assert.ok( hovers.length > 0, "Should have hover for GET" );
    assert.ok( hoverContains( hovers, "GET" ), "Hover should mention GET" );
  } );

  test( "Status code 200 shows OK on hover", async () => {
    const hovers = await getHover( doc, new vscode.Position( 1, 6 ) );
    assert.ok( hovers.length > 0, "Should have hover for status code 200" );
    assert.ok( hoverContains( hovers, "200" ), "Hover should mention 200" );
    assert.ok( hoverContains( hovers, "OK" ), "Hover should mention OK" );
  } );

  test( "Section [Asserts] shows description on hover", async () => {
    const hovers = await getHover( doc, new vscode.Position( 6, 3 ) );
    assert.ok( hovers.length > 0, "Should have hover for [Asserts]" );
    assert.ok( hoverContains( hovers, "Asserts" ), "Hover should mention Asserts" );
  } );

  test( "Section [Options] shows description on hover", async () => {
    const hovers = await getHover( doc, new vscode.Position( 2, 3 ) );
    assert.ok( hovers.length > 0, "Should have hover for [Options]" );
    assert.ok( hoverContains( hovers, "Options" ), "Hover should mention Options" );
  } );

  test( "Assert predicate 'contains' shows hover", async () => {
    const hovers = await getHover( doc, new vscode.Position( 8, 25 ) );
    assert.ok( hovers.length > 0, "Should have hover for contains predicate" );
    assert.ok( hoverContains( hovers, "contains" ), "Hover should mention contains" );
  } );

  test( "Variable name in placeholder shows variable hover", async () => {
    const hovers = await getHover( doc, new vscode.Position( 7, 23 ) );
    assert.ok( hovers.length > 0, "Should have hover for variable" );
    assert.ok( hoverContains( hovers, "Hurl variable" ), "Hover should identify variable kind" );
    assert.ok( hoverContains( hovers, "captured" ), "Hover should indicate variable source" );
  } );
} );

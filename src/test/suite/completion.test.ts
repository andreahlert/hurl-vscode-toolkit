import * as assert from "node:assert";
import * as vscode from "vscode";
import * as path from "node:path";
import { sleep, FIXTURES_PATH } from "./helpers";
import { GraphQLCompletionProvider } from "../../providers/graphql.completion";

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

function hasLabel( list: vscode.CompletionList, label: string ): boolean {
  return list.items.some( ( item ) => {
    if ( typeof item.label === "string" ) {
      return item.label === label;
    }
    return ( item.label as vscode.CompletionItemLabel ).label === label;
  } );
}

suite( "Completion Provider", () => {
  let doc: vscode.TextDocument;
  const schemaUri = vscode.Uri.file( path.join( FIXTURES_PATH, "completion-schema.graphqls" ) );

  suiteSetup( async () => {
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
      "{",                                   // line 14: variable
      "variable: api_host=example.org",      // line 15: options variable style
      'variable "user_id" ',                 // line 16: variable query in asserts/captures
      "",                                    // line 17
      "```graphql",                         // line 18: GraphQL fenced block
      "",                                   // line 19: operation-root GraphQL completions
      "query GetUser {",                    // line 20
      "  ",                                 // line 21: query root fields
      "  user(id: \"1\") {",             // line 22
      "    ",                               // line 23: nested User fields
      "  }",                                // line 24
      "}",                                  // line 25
      "",                                   // line 26
      "mutation UpdateUser {",              // line 27
      "  ",                                 // line 28: mutation root fields
      "  updateUser(id: \"1\", name: \"Alice\") {", // line 29
      "    ",                               // line 30: mutation payload fields
      "  }",                                // line 31
      "}",                                  // line 32
      "```",                                // line 33
    ].join( "\n" );

    const uri = vscode.Uri.file( path.join( FIXTURES_PATH, "completion-test.hurl" ) );
    const wsEdit = new vscode.WorkspaceEdit();
    wsEdit.createFile( uri, { overwrite: true } );
    await vscode.workspace.applyEdit( wsEdit );

    const wsEdit2 = new vscode.WorkspaceEdit();
    wsEdit2.insert( uri, new vscode.Position( 0, 0 ), content );
    await vscode.workspace.applyEdit( wsEdit2 );

    const schemaContent = [
      "type Query {",
      "  user(id: ID!): User",
      "  viewer: User",
      "}",
      "",
      "type Mutation {",
      "  updateUser(id: ID!, name: String!): UpdateUserPayload",
      "}",
      "",
      "type UpdateUserPayload {",
      "  user: User",
      "  success: Boolean!",
      "}",
      "",
      "type User {",
      "  id: ID!",
      "  email: String!",
      "  name: String!",
      "}",
    ].join( "\n" );

    const schemaEdit = new vscode.WorkspaceEdit();
    schemaEdit.createFile( schemaUri, { overwrite: true } );
    await vscode.workspace.applyEdit( schemaEdit );

    const schemaEdit2 = new vscode.WorkspaceEdit();
    schemaEdit2.insert( schemaUri, new vscode.Position( 0, 0 ), schemaContent );
    await vscode.workspace.applyEdit( schemaEdit2 );

    doc = await vscode.workspace.openTextDocument( uri );
    await vscode.window.showTextDocument( doc );
    await sleep( 2000 );
  } );

  suiteTeardown( async () => {
    await vscode.commands.executeCommand( "workbench.action.closeActiveEditor" );
    // Clean up the temp file
    try {
      const uri = vscode.Uri.file( path.join( FIXTURES_PATH, "completion-test.hurl" ) );
      await vscode.workspace.fs.delete( uri );
    } catch {
      // ignore
    }
    try {
      await vscode.workspace.fs.delete( schemaUri );
    } catch {
      // ignore
    }
  } );

  test( "HTTP methods at empty line start", async () => {
    const completions = await getCompletions( doc, new vscode.Position( 0, 0 ) );
    assert.ok( hasLabel( completions, "GET" ), "Should suggest GET" );
    assert.ok( hasLabel( completions, "POST" ), "Should suggest POST" );
    assert.ok( hasLabel( completions, "PUT" ), "Should suggest PUT" );
    assert.ok( hasLabel( completions, "DELETE" ), "Should suggest DELETE" );
    assert.ok( hasLabel( completions, "PATCH" ), "Should suggest PATCH" );
    assert.ok( hasLabel( completions, "HEAD" ), "Should suggest HEAD" );
    assert.ok( hasLabel( completions, "OPTIONS" ), "Should suggest OPTIONS" );
  } );

  test( "Method completions include descriptions", async () => {
    const completions = await getCompletions( doc, new vscode.Position( 0, 0 ) );
    const getItem = completions.items.find( ( item ) => {
      const label = typeof item.label === "string" ? item.label : ( item.label as vscode.CompletionItemLabel ).label;
      return label === "GET";
    } );
    assert.ok( getItem, "GET completion should exist" );
    assert.ok( getItem!.detail, "GET should have detail/description" );
  } );

  test( "Status codes after HTTP keyword", async () => {
    const completions = await getCompletions( doc, new vscode.Position( 5, 5 ) );
    assert.ok( hasLabel( completions, "200" ), "Should suggest 200" );
    assert.ok( hasLabel( completions, "201" ), "Should suggest 201" );
    assert.ok( hasLabel( completions, "404" ), "Should suggest 404" );
    assert.ok( hasLabel( completions, "500" ), "Should suggest 500" );
  } );

  test( "Status code completions include documentation", async () => {
    const completions = await getCompletions( doc, new vscode.Position( 5, 5 ) );
    const item200 = completions.items.find( ( item ) => {
      const label = typeof item.label === "string" ? item.label : ( item.label as vscode.CompletionItemLabel ).label;
      return label === "200";
    } );
    assert.ok( item200, "200 completion should exist" );
    assert.ok( item200!.detail, "200 should have detail" );
    assert.ok(
      item200!.detail!.includes( "OK" ) || item200!.detail!.includes( "200" ),
      "200 detail should mention OK or 200"
    );
  } );

  test( "Section names when typing [", async () => {
    const completions = await getCompletions( doc, new vscode.Position( 6, 1 ) );
    assert.ok( hasLabel( completions, "[Asserts]" ), "Should suggest [Asserts]" );
    assert.ok( hasLabel( completions, "[Captures]" ), "Should suggest [Captures]" );
    assert.ok( hasLabel( completions, "[Options]" ), "Should suggest [Options]" );
    assert.ok( hasLabel( completions, "[QueryStringParams]" ), "Should suggest [QueryStringParams]" );
    assert.ok( hasLabel( completions, "[Query]" ), "Should suggest [Query] alias" );
    assert.ok( hasLabel( completions, "[FormParams]" ), "Should suggest [FormParams]" );
    assert.ok( hasLabel( completions, "[Form]" ), "Should suggest [Form] alias" );
    assert.ok( hasLabel( completions, "[Multipart]" ), "Should suggest [Multipart] alias" );
    assert.ok( hasLabel( completions, "[BasicAuth]" ), "Should suggest [BasicAuth]" );
  } );

  test( "Section completions include documentation", async () => {
    const completions = await getCompletions( doc, new vscode.Position( 6, 1 ) );
    const assertsItem = completions.items.find( ( item ) => {
      const label = typeof item.label === "string" ? item.label : ( item.label as vscode.CompletionItemLabel ).label;
      return label === "[Asserts]";
    } );
    assert.ok( assertsItem, "[Asserts] completion should exist" );
    assert.ok( assertsItem!.documentation, "[Asserts] should have documentation" );
    assert.strictEqual(
      assertsItem!.insertText instanceof vscode.SnippetString ? assertsItem!.insertText.value : String( assertsItem!.insertText ),
      "Asserts",
      "Section completion should insert the bare section name"
    );
  } );

  test( "Header values trigger after typing :", async () => {
    const completions = await getCompletions( doc, new vscode.Position( 3, 13 ) );
    assert.ok( hasLabel( completions, "application/json" ), "Should suggest header values after the colon" );
  } );

  test( "Assert predicates after jsonpath query", async () => {
    const completions = await getCompletions( doc, new vscode.Position( 9, 20 ) );
    // Check for common predicates
    assert.ok( hasLabel( completions, "==" ), "Should suggest ==" );
    assert.ok( hasLabel( completions, "!=" ), "Should suggest !=" );
    assert.ok( hasLabel( completions, "contains" ), "Should suggest contains" );
    assert.ok( hasLabel( completions, "exists" ), "Should suggest exists" );
    assert.ok( hasLabel( completions, "matches" ), "Should suggest matches" );
    assert.ok( hasLabel( completions, "count" ), "Should suggest count filter" );
    assert.ok( hasLabel( completions, "split" ), "Should suggest split filter" );
  } );

  test( "Options inside [Options] section", async () => {
    const completions = await getCompletions( doc, new vscode.Position( 11, 0 ) );
    assert.ok( hasLabel( completions, "retry" ), "Should suggest retry" );
    assert.ok( hasLabel( completions, "delay" ), "Should suggest delay" );
    assert.ok( hasLabel( completions, "location" ), "Should suggest location" );
    assert.ok( hasLabel( completions, "verbose" ), "Should suggest verbose" );
    assert.ok( hasLabel( completions, "variable" ), "Should suggest variable option" );
  } );

  test( "Capture queries include advanced query kinds", async () => {
    const completions = await getCompletions( doc, new vscode.Position( 13, 9 ) );
    assert.ok( hasLabel( completions, "jsonpath" ), "Should suggest jsonpath" );
    assert.ok( hasLabel( completions, "rawbytes" ), "Should suggest rawbytes" );
    assert.ok( hasLabel( completions, "redirects" ), "Should suggest redirects" );
    assert.ok( hasLabel( completions, "variable" ), "Should suggest variable query" );
  } );

  test( "Variable placeholders include captured and option variables", async () => {
    const completions = await getCompletions( doc, new vscode.Position( 14, 2 ) );
    assert.ok( hasLabel( completions, "user_id" ), "Should suggest captured variable" );
    assert.ok( hasLabel( completions, "api_host" ), "Should suggest option variable" );
  } );

  test( "Variable placeholders include template functions", async () => {
    const completions = await getCompletions( doc, new vscode.Position( 14, 2 ) );
    assert.ok( hasLabel( completions, "newDate" ), "Should suggest newDate function" );
    assert.ok( hasLabel( completions, "newUuid" ), "Should suggest newUuid function" );
    assert.ok( hasLabel( completions, "getEnv" ), "Should suggest getEnv function" );
  } );

  test( "GraphQL root suggestions stay limited to operations", async () => {
    const completions = await getCompletions( doc, new vscode.Position( 19, 0 ) );
    assert.ok( hasLabel( completions, "query" ), "Should suggest query" );
    assert.ok( hasLabel( completions, "mutation" ), "Should suggest mutation" );
    assert.ok( hasLabel( completions, "subscription" ), "Should suggest subscription" );
    assert.ok( !hasLabel( completions, "User" ), "Should not leak schema types at the GraphQL root" );
    assert.ok( !hasLabel( completions, "id" ), "Should not leak fields at the GraphQL root" );
  } );

  test( "Query root fields come from the Query return type", async () => {
    const completions = await getCompletions( doc, new vscode.Position( 21, 2 ) );
    assert.ok( hasLabel( completions, "user" ), "Should suggest Query fields" );
    assert.ok( hasLabel( completions, "viewer" ), "Should suggest Query fields" );
    assert.ok( !hasLabel( completions, "success" ), "Should not suggest mutation payload fields in a query root" );
  } );

  test( "Nested query fields come from the returned object type", async () => {
    const completions = await getCompletions( doc, new vscode.Position( 23, 4 ) );
    assert.ok( hasLabel( completions, "id" ), "Should suggest User fields" );
    assert.ok( hasLabel( completions, "email" ), "Should suggest User fields" );
    assert.ok( hasLabel( completions, "name" ), "Should suggest User fields" );
    assert.ok( !hasLabel( completions, "success" ), "Should not suggest mutation payload fields inside User" );
  } );

  test( "Mutation payload fields come from the mutation return type", async () => {
    const completions = await getCompletions( doc, new vscode.Position( 30, 4 ) );
    assert.ok( hasLabel( completions, "user" ), "Should suggest mutation payload fields" );
    assert.ok( hasLabel( completions, "success" ), "Should suggest mutation payload fields" );
    assert.ok( !hasLabel( completions, "id" ), "Should not suggest User fields inside mutation payload" );
  } );

  test( "GraphQL introspection adds schema-backed completions", async () => {
    const fetchCalls: Array<{ input: string; init?: { method?: string; headers?: Record<string, string>; body?: string } }> = [];
    const provider = new GraphQLCompletionProvider( async ( input, init ) => {
      fetchCalls.push( { input, init } );
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            data: {
              __schema: {
                queryType: { name: "Query" },
                mutationType: null,
                subscriptionType: null,
                types: [
                  {
                    kind: "OBJECT",
                    name: "Query",
                    fields: [
                      {
                        name: "searchUsers",
                        type: {
                          kind: "LIST",
                          name: null,
                          ofType: {
                            kind: "OBJECT",
                            name: "User",
                            ofType: null,
                          },
                        },
                      },
                    ],
                    enumValues: null,
                  },
                  {
                    kind: "OBJECT",
                    name: "User",
                    fields: [
                      {
                        name: "id",
                        type: {
                          kind: "NON_NULL",
                          name: null,
                          ofType: {
                            kind: "SCALAR",
                            name: "ID",
                            ofType: null,
                          },
                        },
                      },
                    ],
                    enumValues: null,
                  },
                ],
              },
            },
          };
        },
        async text() {
          return "";
        },
      };
    } );

    const gqlDoc = await vscode.workspace.openTextDocument( {
      language: "hurl",
      content: [
        "POST https://example.org/graphql",
        "Content-Type: application/json",
        "",
        "```graphql",
        "query Test {",
        "  ",
        "}",
        "```",
      ].join( "\n" ),
    } );

    await provider.fetchAndCacheSchemaForDocument( gqlDoc, new vscode.Position( 5, 2 ) );
    const schema = await provider.buildGraphQLSchemaIndex( gqlDoc, new vscode.Position( 5, 2 ) );
    const context = provider.getGraphQLCompletionContext( gqlDoc, new vscode.Position( 5, 2 ), schema );

    assert.equal( context.parentTypeName, "Query", "Should resolve the GraphQL root type from introspection" );
    assert.ok( fetchCalls.length === 1, "Should query the endpoint once" );

    const completions = provider.getGraphQLFieldCompletions( schema, "Query", "" );
    assert.ok( completions.some( ( item ) => ( typeof item.label === "string" ? item.label : item.label.label ) === "searchUsers" ),
      "Should include fields from the introspected schema" );
  } );
} );

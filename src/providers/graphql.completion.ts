import * as vscode from "vscode";
import { parseHurlEntries, HurlEntry } from "../utils/hurlParser";
import { GraphQLSchemaIndex, GraphQLTypeDefinition, GraphQLCompletionContext, GraphQLSelectionState, GraphQLBlockBounds, GraphQLOperationType } from "../utils/graphql.completion.types";

type GraphQLFetchResponse = {
    ok: boolean;
    status: number;
    json(): Promise<any>;
    text(): Promise<string>;
};

type GraphQLFetchInit = {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
};

type GraphQLFetch = ( input: string, init?: GraphQLFetchInit ) => Promise<GraphQLFetchResponse>;

type GraphQLIntrospectionFieldType = {
    kind: string;
    name: string | null;
    ofType?: GraphQLIntrospectionFieldType | null;
};

type GraphQLIntrospectionField = {
    name: string;
    args?: Array<{ name: string; type: GraphQLIntrospectionFieldType }> | null;
    type: GraphQLIntrospectionFieldType;
};

type GraphQLIntrospectionType = {
    kind: string;
    name: string;
    fields?: GraphQLIntrospectionField[] | null;
    inputFields?: Array<{ name: string; type: GraphQLIntrospectionFieldType }> | null;
    enumValues?: Array<{ name: string }> | null;
};

type GraphQLIntrospectionSchema = {
    queryType?: { name: string } | null;
    mutationType?: { name: string } | null;
    subscriptionType?: { name: string } | null;
    types?: GraphQLIntrospectionType[] | null;
};

type GraphQLRequestContext = {
    entry: HurlEntry;
    headers: Record<string, string>;
    url: string;
};

const GRAPHQL_INTROSPECTION_QUERY = `query IntrospectionQuery {
  __schema {
    queryType { name }
    mutationType { name }
    subscriptionType { name }
    types {
      kind
      name
      fields(includeDeprecated: true) {
        name
        args {
          name
          type {
            kind
            name
            ofType {
              kind
              name
              ofType { kind name }
            }
          }
        }
        type {
          kind
          name
          ofType {
            kind
            name
            ofType {
              kind
              name
              ofType {
                kind
                name
                ofType {
                  kind
                  name
                  ofType {
                    kind
                    name
                    ofType {
                      kind
                      name
                    }
                  }
                }
              }
            }
          }
        }
      }
      inputFields {
        name
        type {
          kind
          name
          ofType {
            kind
            name
            ofType { kind name }
          }
        }
      }
      enumValues(includeDeprecated: true) {
        name
      }
    }
  }
}`;

const GRAPHQL_REQUEST_HEADER_BLACKLIST = new Set( [
    "host",
    "connection",
    "content-length",
    "accept-encoding",
    "user-agent",
    "transfer-encoding",
    "expect",
] );

export class GraphQLCompletionProvider {
    private readonly introspectionSchemaCache = new Map<string, Promise<GraphQLSchemaIndex | undefined>>();
    private readonly outputChannel: vscode.OutputChannel;

    constructor(
        private readonly fetchImpl: GraphQLFetch = globalThis.fetch.bind( globalThis ),
    ) {
        this.outputChannel = vscode.window.createOutputChannel( "Hurl Toolkit GraphQL" );
    }

    public async buildGraphQLSchemaIndex( document?: vscode.TextDocument, position?: vscode.Position ): Promise<GraphQLSchemaIndex> {
        const schema: GraphQLSchemaIndex = {
            types: new Map(),
            rootTypes: {},
        };

        await this.mergeWorkspaceGraphQLSchemas( schema );

        if ( document && position ) {
            const introspectedSchema = await this.buildGraphQLIntrospectionSchema( document, position );
            if ( introspectedSchema ) {
                this.mergeGraphQLSchemaIndex( schema, introspectedSchema );
            }
        }

        this.applyDefaultGraphQLRootTypes( schema );
        return schema;
    }

    private async mergeWorkspaceGraphQLSchemas( schema: GraphQLSchemaIndex ): Promise<void> {
        const files = new Map<string, vscode.Uri>();

        for ( const pattern of [ "**/*.graphql", "**/*.graphqls" ] ) {
            for ( const file of await vscode.workspace.findFiles( pattern, "**/node_modules/**" ) ) {
                files.set( file.toString(), file );
            }
        }

        for ( const file of files.values() ) {
            try {
                const bytes = await vscode.workspace.fs.readFile( file );
                this.mergeGraphQLSchemaText( schema, new TextDecoder().decode( bytes ) );
            } catch {
                continue;
            }
        }
    }

    private mergeGraphQLSchemaIndex( target: GraphQLSchemaIndex, source: GraphQLSchemaIndex ): void {
        for ( const [ typeName, typeDefinition ] of source.types.entries() ) {
            const existingType = target.types.get( typeName );
            if ( !existingType ) {
                target.types.set( typeName, {
                    kind: typeDefinition.kind,
                    fields: new Map( typeDefinition.fields ),
                    enumValues: [ ...typeDefinition.enumValues ],
                } );
                continue;
            }

            existingType.kind = typeDefinition.kind;

            for ( const [ fieldName, fieldDefinition ] of typeDefinition.fields.entries() ) {
                existingType.fields.set( fieldName, {
                    typeName: fieldDefinition.typeName,
                    args: fieldDefinition.args ? new Map( fieldDefinition.args ) : undefined,
                } );
            }

            for ( const enumValue of typeDefinition.enumValues ) {
                if ( !existingType.enumValues.includes( enumValue ) ) {
                    existingType.enumValues.push( enumValue );
                }
            }
        }

        for ( const operationType of [ "query", "mutation", "subscription" ] as const ) {
            if ( source.rootTypes[ operationType ] ) {
                target.rootTypes[ operationType ] = source.rootTypes[ operationType ];
            }
        }
    }

    private async buildGraphQLIntrospectionSchema( document: vscode.TextDocument, position: vscode.Position ): Promise<GraphQLSchemaIndex | undefined> {
        const requestContext = this.getGraphQLRequestContext( document, position );
        if ( !requestContext ) {
            return undefined;
        }

        const cacheKey = this.getGraphQLIntrospectionCacheKey( requestContext );
        const cachedSchema = this.introspectionSchemaCache.get( cacheKey );
        if ( cachedSchema !== undefined ) {
            return cachedSchema;
        }

        return undefined;
    }

    public async fetchAndCacheSchemaForDocument( document: vscode.TextDocument, position: vscode.Position ): Promise<void> {
        const requestContext = this.getGraphQLRequestContext( document, position );
        if ( !requestContext ) {
            vscode.window.showErrorMessage( "Hurl Toolkit: Place the cursor inside a ```graphql block to fetch the schema." );
            return;
        }

        const cacheKey = this.getGraphQLIntrospectionCacheKey( requestContext );
        this.introspectionSchemaCache.delete( cacheKey );

        await vscode.window.withProgress(
            { location: vscode.ProgressLocation.Notification, title: "Hurl: Fetching GraphQL schema…", cancellable: false },
            async () => {
                const schema = await this.fetchGraphQLIntrospectionSchema( requestContext );
                if ( schema ) {
                    this.introspectionSchemaCache.set( cacheKey, Promise.resolve( schema ) );
                    vscode.window.showInformationMessage( `Hurl: GraphQL schema loaded (${schema.types.size} types).` );
                }
            }
        );
    }

    private resolveVariables( text: string, document?: vscode.TextDocument ): string {
        return text.replace( /\{\{([^}]+)\}\}/g, ( _match, varName: string ) => {
            const trimmed = varName.trim();

            const envValue = process.env[ `HURL_VARIABLE_${trimmed}` ];
            if ( envValue !== undefined ) {
                return envValue;
            }

            const envDirectValue = process.env[ trimmed ];
            if ( envDirectValue !== undefined ) {
                return envDirectValue;
            }

            if ( document ) {
                const optionVars = this.collectOptionVariables( document );
                if ( trimmed in optionVars ) {
                    return optionVars[ trimmed ];
                }
            }

            const config = vscode.workspace.getConfiguration( "hurl-toolkit" );
            const activeProfileName = config.get<string>( "activeEnvironmentProfile", "" ).trim();
            const profiles = config.get<Record<string, { variables?: Record<string, string> }>>( "environmentProfiles", {} ) ?? {};

            for ( const [ profileName, profile ] of Object.entries( profiles ) ) {
                const vars = profile.variables ?? {};
                if ( trimmed in vars ) {
                    if ( profileName === activeProfileName ) {
                        return vars[ trimmed ];
                    }
                }
            }

            return "localhost";
        } );
    }

    private collectOptionVariables( document: vscode.TextDocument ): Record<string, string> {
        const vars: Record<string, string> = {};
        let inOptions = false;

        for ( let i = 0; i < document.lineCount; i++ ) {
            const line = document.lineAt( i ).text.trim();
            if ( line.startsWith( "[" ) ) {
                inOptions = line.toLowerCase() === "[options]";
                continue;
            }
            if ( inOptions ) {
                const match = line.match( /^variable\s*:\s*([A-Za-z][A-Za-z0-9_-]*)\s*=\s*(.+)$/i );
                if ( match ) {
                    vars[ match[ 1 ] ] = match[ 2 ].trim();
                }
            }
        }

        return vars;
    }

    private getGraphQLRequestContext( document: vscode.TextDocument, position: vscode.Position ): GraphQLRequestContext | undefined {
        const blockBounds = this.findGraphQLBlockBounds( document, position );
        if ( !blockBounds ) {
            return undefined;
        }

        const entry = parseHurlEntries( document ).find( ( candidate ) => position.line >= candidate.startLine && position.line <= candidate.endLine );
        if ( !entry ) {
            return undefined;
        }

        let url = this.resolveVariables( entry.url.trim(), document );
        if ( !/^https?:\/\//i.test( url ) ) {
            url = `http://${url}`;
        }

        const rawHeaders = this.collectGraphQLRequestHeaders( document, entry.startLine + 1, blockBounds.startLine );
        const headers: Record<string, string> = {};
        for ( const [ key, value ] of Object.entries( rawHeaders ) ) {
            headers[ key ] = this.resolveVariables( value, document );
        }
        if ( !headers[ "Content-Type" ] ) {
            headers[ "Content-Type" ] = "application/json";
        }

        this.outputChannel.appendLine( `[GraphQL] Resolved introspection URL: ${url}` );
        this.outputChannel.appendLine( `[GraphQL] Resolved introspection headers: ${JSON.stringify( headers, null, 2 )}` );

        return { entry, headers, url };
    }

    private getGraphQLIntrospectionCacheKey( requestContext: GraphQLRequestContext ): string {
        const headerKey = Object.entries( requestContext.headers )
            .map( ( [ name, value ] ) => `${name.toLowerCase()}:${value}` )
            .sort( ( left, right ) => left.localeCompare( right ) )
            .join( "\n" );

        return `${requestContext.url}\n${headerKey}`;
    }

    private collectGraphQLRequestHeaders( document: vscode.TextDocument, startLine: number, endLine: number ): Record<string, string> {
        const headers: Record<string, string> = {};

        for ( let lineIndex = startLine; lineIndex < endLine; lineIndex++ ) {
            const lineText = document.lineAt( lineIndex ).text.trim();
            if ( lineText === "" ) {
                break;
            }

            const headerMatch = /^([A-Za-z0-9-]+)\s*:\s*(.+)$/.exec( lineText );
            if ( !headerMatch ) {
                if ( lineText.startsWith( "[" ) || lineText.startsWith( "```" ) ) {
                    break;
                }
                continue;
            }

            const headerName = headerMatch[ 1 ];
            if ( GRAPHQL_REQUEST_HEADER_BLACKLIST.has( headerName.toLowerCase() ) ) {
                continue;
            }

            headers[ headerName ] = headerMatch[ 2 ];
        }

        return headers;
    }

    private async fetchGraphQLIntrospectionSchema( requestContext: GraphQLRequestContext ): Promise<GraphQLSchemaIndex | undefined> {
        this.outputChannel.appendLine( `[GraphQL] Sending introspection POST to ${requestContext.url}` );

        let response: GraphQLFetchResponse;
        try {
            response = await this.fetchImpl( requestContext.url, {
                method: "POST",
                headers: {
                    ...requestContext.headers,
                    "Content-Type": "application/json",
                    Accept: "application/json, application/graphql-response+json",
                },
                body: JSON.stringify( {
                    query: GRAPHQL_INTROSPECTION_QUERY,
                } ),
            } );
        } catch ( error ) {
            this.outputChannel.appendLine( `[GraphQL] Introspection request failed (network error): ${error}` );
            this.outputChannel.show();
            return undefined;
        }

        this.outputChannel.appendLine( `[GraphQL] Introspection response status: ${response.status}` );

        if ( !response.ok ) {
            this.outputChannel.appendLine( `[GraphQL] Introspection request returned ${response.status}` );
            this.outputChannel.show();
            return undefined;
        }

        let payload: { data?: { __schema?: GraphQLIntrospectionSchema } };
        try {
            payload = await response.json();
        } catch {
            this.outputChannel.appendLine( `[GraphQL] Failed to parse introspection response as JSON` );
            this.outputChannel.show();
            return undefined;
        }

        const schemaData = payload.data?.__schema;
        if ( !schemaData ) {
            this.outputChannel.appendLine( `[GraphQL] Introspection response missing __schema data` );
            this.outputChannel.show();
            return undefined;
        }

        this.outputChannel.appendLine( `[GraphQL] Introspection succeeded: ${schemaData.types?.length ?? 0} types found` );

        return this.buildGraphQLSchemaIndexFromIntrospection( schemaData );
    }

    private buildGraphQLSchemaIndexFromIntrospection( schemaData: GraphQLIntrospectionSchema ): GraphQLSchemaIndex {
        const schema: GraphQLSchemaIndex = {
            types: new Map(),
            rootTypes: {},
        };

        if ( schemaData.queryType?.name ) {
            schema.rootTypes.query = schemaData.queryType.name;
        }
        if ( schemaData.mutationType?.name ) {
            schema.rootTypes.mutation = schemaData.mutationType.name;
        }
        if ( schemaData.subscriptionType?.name ) {
            schema.rootTypes.subscription = schemaData.subscriptionType.name;
        }

        for ( const type of schemaData.types ?? [] ) {
            if ( !type.name || type.name.startsWith( "__" ) ) {
                continue;
            }

            const typeDefinition: GraphQLTypeDefinition = {
                kind: this.mapIntrospectionTypeKind( type.kind ),
                fields: new Map(),
                enumValues: [],
            };

            for ( const field of type.fields ?? [] ) {
                const args = field.args?.length
                    ? new Map( field.args.map( ( arg ) => [
                        arg.name,
                        { typeName: this.extractGraphQLNamedTypeFromIntrospection( arg.type ) },
                    ] ) )
                    : undefined;
                typeDefinition.fields.set( field.name, {
                    typeName: this.extractGraphQLNamedTypeFromIntrospection( field.type ),
                    args,
                } );
            }

            for ( const inputField of type.inputFields ?? [] ) {
                typeDefinition.fields.set( inputField.name, {
                    typeName: this.extractGraphQLNamedTypeFromIntrospection( inputField.type ),
                } );
            }

            for ( const enumValue of type.enumValues ?? [] ) {
                typeDefinition.enumValues.push( enumValue.name );
            }

            schema.types.set( type.name, typeDefinition );
        }

        return schema;
    }

    private mapIntrospectionTypeKind( kind: string ): GraphQLTypeDefinition[ "kind" ] {
        switch ( kind ) {
            case "OBJECT":
                return "type";
            case "INTERFACE":
                return "interface";
            case "INPUT_OBJECT":
                return "input";
            case "ENUM":
                return "enum";
            case "SCALAR":
                return "scalar";
            case "UNION":
                return "union";
            default:
                return "type";
        }
    }

    private extractGraphQLNamedTypeFromIntrospection( typeRef: GraphQLIntrospectionFieldType | null | undefined ): string | undefined {
        let current: GraphQLIntrospectionFieldType | null | undefined = typeRef;
        while ( current ) {
            if ( current.name ) {
                return current.name;
            }
            current = current.ofType;
        }

        return undefined;
    }

    private mergeGraphQLSchemaText( schema: GraphQLSchemaIndex, text: string ): void {
        const lines = text.split( /\r?\n/ );
        let currentTypeName: string | undefined;
        let currentTypeKind: GraphQLTypeDefinition[ "kind" ] | undefined;
        let inSchemaBlock = false;

        for ( const rawLine of lines ) {
            const line = rawLine.trim();
            if ( line === "" || line.startsWith( "#" ) ) {
                continue;
            }

            if ( inSchemaBlock ) {
                if ( line.startsWith( "}" ) ) {
                    inSchemaBlock = false;
                    continue;
                }

                const rootMatch = line.match( /^(query|mutation|subscription)\s*:\s*([_A-Za-z][_0-9A-Za-z]*)/ );
                if ( rootMatch ) {
                    schema.rootTypes[ rootMatch[ 1 ] as GraphQLOperationType ] = rootMatch[ 2 ];
                }
                continue;
            }

            if ( currentTypeName && currentTypeKind ) {
                if ( line.startsWith( "}" ) ) {
                    currentTypeName = undefined;
                    currentTypeKind = undefined;
                    continue;
                }

                const typeDefinition = schema.types.get( currentTypeName );
                if ( !typeDefinition ) {
                    continue;
                }

                if ( currentTypeKind === "enum" ) {
                    const enumValueMatch = line.match( /^([_A-Za-z][_0-9A-Za-z]*)\b/ );
                    if ( enumValueMatch ) {
                        typeDefinition.enumValues.push( enumValueMatch[ 1 ] );
                    }
                    continue;
                }

                const fieldMatch = line.match( /^([_A-Za-z][_0-9A-Za-z]*)\s*(?:\([^)]*\))?\s*:\s*([^#]+)/ );
                if ( fieldMatch ) {
                    typeDefinition.fields.set( fieldMatch[ 1 ], {
                        typeName: this.extractGraphQLNamedType( fieldMatch[ 2 ] ),
                    } );
                }
                continue;
            }

            if ( line.startsWith( "schema" ) && line.includes( "{" ) ) {
                inSchemaBlock = true;
                continue;
            }

            const definitionMatch = line.match( /^(type|interface|input|enum|scalar|union)\s+([_A-Za-z][_0-9A-Za-z]*)\b/ );
            if ( !definitionMatch ) {
                continue;
            }

            currentTypeKind = definitionMatch[ 1 ] as GraphQLTypeDefinition[ "kind" ];
            currentTypeName = definitionMatch[ 2 ];
            if ( !schema.types.has( currentTypeName ) ) {
                schema.types.set( currentTypeName, {
                    kind: currentTypeKind,
                    fields: new Map(),
                    enumValues: [],
                } );
            }

            if ( currentTypeKind === "schema" ) {
                inSchemaBlock = true;
                currentTypeName = undefined;
                currentTypeKind = undefined;
            }
        }
    }

    private applyDefaultGraphQLRootTypes( schema: GraphQLSchemaIndex ): void {
        if ( !schema.rootTypes.query && schema.types.has( "Query" ) ) {
            schema.rootTypes.query = "Query";
        }
        if ( !schema.rootTypes.mutation && schema.types.has( "Mutation" ) ) {
            schema.rootTypes.mutation = "Mutation";
        }
        if ( !schema.rootTypes.subscription && schema.types.has( "Subscription" ) ) {
            schema.rootTypes.subscription = "Subscription";
        }
    }

    private extractGraphQLNamedType( typeRef: string ): string | undefined {
        const match = typeRef.replace( /[!\[\]\s]/g, "" ).match( /^([_A-Za-z][_0-9A-Za-z]*)/ );
        return match ? match[ 1 ] : undefined;
    }

    public getGraphQLCompletionContext(
        document: vscode.TextDocument,
        position: vscode.Position,
        schema: GraphQLSchemaIndex
    ): GraphQLCompletionContext {
        const blockBounds = this.findGraphQLBlockBounds( document, position );
        const prefix = this.getGraphQLPrefix( document, position );

        if ( !blockBounds ) {
            return { mode: "operation-root", prefix };
        }

        const start = new vscode.Position( blockBounds.startLine + 1, 0 );
        const text = document.getText( new vscode.Range( start, position ) );
        const state = this.scanGraphQLSelectionState( text, schema );

        if ( state.insideArguments && state.selectionTypeStack.length > 0 ) {
            return {
                mode: "argument",
                prefix,
                parentTypeName: state.selectionTypeStack.at( -1 ),
                argumentFieldName: state.argumentFieldName,
            };
        }

        return {
            mode: state.selectionTypeStack.length > 0 ? "selection-set" : "operation-root",
            prefix,
            operationType: state.operationType,
            parentTypeName: state.selectionTypeStack.at( -1 ),
        };
    }

    private scanGraphQLSelectionState( text: string, schema: GraphQLSchemaIndex ): GraphQLSelectionState {
        const selectionTypeStack: Array<string | undefined> = [];
        let operationType: GraphQLOperationType | undefined;
        let fragmentTypeName: string | undefined;
        let inFragmentDefinition = false;
        let awaitingFragmentType = false;
        let pendingFieldName: string | undefined;
        let parenDepth = 0;
        let argumentFieldName: string | undefined;
        let currentToken = "";
        let previousToken = "";

        const reservedTokens = new Set( [
            "query",
            "mutation",
            "subscription",
            "fragment",
            "on",
            "schema",
            "type",
            "interface",
            "input",
            "enum",
            "union",
            "scalar",
            "implements",
            "extend",
            "directive",
            "repeatable",
            "true",
            "false",
            "null",
        ] );

        const pushSelectionType = ( typeName: string | undefined ) => {
            selectionTypeStack.push( typeName );
            pendingFieldName = undefined;
        };

        const flushToken = () => {
            if ( currentToken === "" ) {
                return;
            }

            const token = currentToken;
            currentToken = "";

            if ( parenDepth === 0 ) {
                if ( selectionTypeStack.length === 0 ) {
                    if ( token === "query" || token === "mutation" || token === "subscription" ) {
                        operationType = token;
                    } else if ( token === "fragment" ) {
                        inFragmentDefinition = true;
                    } else if ( inFragmentDefinition && previousToken === "on" ) {
                        fragmentTypeName = token;
                        awaitingFragmentType = false;
                    }
                } else {
                    if ( previousToken === "on" || previousToken === "..." ) {
                        // It's an inline fragment type condition like `... on User`
                        pendingFieldName = token;
                        awaitingFragmentType = true;
                    } else if ( !reservedTokens.has( token ) || token === "query" || token === "mutation" || token === "subscription" ) {
                        // Allow reserved words like query/mutation as field names
                        pendingFieldName = token;
                        awaitingFragmentType = false;
                    }
                }
            }

            previousToken = token;
        };

        for ( let index = 0; index < text.length; index++ ) {
            const character = text[ index ];

            if ( character === "#" ) {
                flushToken();
                while ( index < text.length && text[ index ] !== "\n" ) {
                    index++;
                }
                continue;
            }

            if ( character === '"' ) {
                flushToken();
                index++;
                while ( index < text.length ) {
                    if ( text[ index ] === '\\' ) {
                        index += 2;
                        continue;
                    }
                    if ( text[ index ] === '"' ) {
                        break;
                    }
                    index++;
                }
                continue;
            }

            if ( character === "@" ) {
                flushToken();
                // skip directive name and arguments
                while ( index < text.length ) {
                    index++;
                    const nextChar = text[ index ];
                    if ( nextChar === "(" ) {
                        let dirParenDepth = 1;
                        while ( index < text.length && dirParenDepth > 0 ) {
                            index++;
                            if ( text[ index ] === "(" ) dirParenDepth++;
                            if ( text[ index ] === ")" ) dirParenDepth--;
                        }
                        break;
                    }
                    if ( nextChar && !/[A-Za-z0-9_]/.test( nextChar ) && nextChar !== " " && nextChar !== "\t" && nextChar !== "\r" && nextChar !== "\n" ) {
                        index--; // backtrack
                        break;
                    }
                }
                continue;
            }

            if ( /[A-Za-z0-9_]/.test( character ) ) {
                currentToken += character;
                continue;
            }

            flushToken();

            if ( character === "(" ) {
                if ( parenDepth === 0 ) {
                    argumentFieldName = pendingFieldName;
                }
                parenDepth++;
                continue;
            }

            if ( character === ")" ) {
                parenDepth = Math.max( 0, parenDepth - 1 );
                continue;
            }

            if ( character === ":" && parenDepth === 0 ) {
                pendingFieldName = undefined;
                continue;
            }

            if ( character === "{" && parenDepth === 0 ) {
                if ( selectionTypeStack.length === 0 ) {
                    if ( operationType ) {
                        pushSelectionType( this.getGraphQLRootTypeName( schema, operationType ) );
                        operationType = undefined;
                    } else if ( inFragmentDefinition && fragmentTypeName ) {
                        pushSelectionType( fragmentTypeName );
                        fragmentTypeName = undefined;
                        inFragmentDefinition = false;
                    } else {
                        pushSelectionType( this.getGraphQLRootTypeName( schema, "query" ) );
                    }
                    continue;
                }

                if ( awaitingFragmentType && pendingFieldName ) {
                    pushSelectionType( pendingFieldName );
                    awaitingFragmentType = false;
                    continue;
                }

                const parentTypeName = selectionTypeStack[ selectionTypeStack.length - 1 ];
                const nextTypeName = pendingFieldName && parentTypeName
                    ? this.getGraphQLFieldTypeName( schema, parentTypeName, pendingFieldName )
                    : undefined;
                pushSelectionType( nextTypeName );
                continue;
            }

            if ( character === "}" && parenDepth === 0 ) {
                selectionTypeStack.pop();
                pendingFieldName = undefined;
                continue;
            }
        }

        flushToken();

        return {
            selectionTypeStack,
            operationType,
            insideArguments: parenDepth > 0,
            argumentFieldName,
        };
    }

    private getGraphQLRootTypeName( schema: GraphQLSchemaIndex, operationType: GraphQLOperationType ): string | undefined {
        return schema.rootTypes[ operationType ];
    }

    private getGraphQLFieldTypeName( schema: GraphQLSchemaIndex, parentTypeName: string, fieldName: string ): string | undefined {
        const parentType = schema.types.get( parentTypeName );
        if ( !parentType ) {
            return undefined;
        }

        const field = parentType.fields.get( fieldName );
        return field?.typeName;
    }

    public getGraphQLOperationCompletions( prefix: string ): vscode.CompletionItem[] {
        const operations: Array<{ name: string; detail: string }> = [
            { name: "query", detail: "GraphQL query operation" },
            { name: "mutation", detail: "GraphQL mutation operation" },
            { name: "subscription", detail: "GraphQL subscription operation" },
            { name: "fragment", detail: "GraphQL fragment definition" },
        ];

        return operations
            .filter( ( operation ) => this.matchesGraphQLPrefix( operation.name, prefix ) )
            .map( ( operation ) => {
                const item = new vscode.CompletionItem( operation.name, vscode.CompletionItemKind.Keyword );
                item.detail = operation.detail;
                item.insertText = operation.name;
                return item;
            } );
    }

    public getGraphQLFieldCompletions(
        schema: GraphQLSchemaIndex,
        parentTypeName: string,
        prefix: string
    ): vscode.CompletionItem[] {
        const parentType = schema.types.get( parentTypeName );
        if ( !parentType ) {
            return this.getGraphQLFallbackCompletions( prefix );
        }

        if ( parentType.kind === "enum" ) {
            return parentType.enumValues
                .filter( ( value ) => this.matchesGraphQLPrefix( value, prefix ) )
                .map( ( value ) => {
                    const item = new vscode.CompletionItem( value, vscode.CompletionItemKind.EnumMember );
                    item.detail = `GraphQL enum value from ${parentTypeName}`;
                    item.insertText = value;
                    return item;
                } );
        }

        const items: vscode.CompletionItem[] = [
            new vscode.CompletionItem( "__typename", vscode.CompletionItemKind.Property ),
        ];
        items[ 0 ].detail = `GraphQL meta field for ${parentTypeName}`;

        for ( const [ fieldName, field ] of parentType.fields.entries() ) {
            if ( !this.matchesGraphQLPrefix( fieldName, prefix ) ) {
                continue;
            }

            const item = new vscode.CompletionItem( fieldName, vscode.CompletionItemKind.Field );
            item.detail = field.typeName ? `GraphQL field returning ${field.typeName}` : `GraphQL field from ${parentTypeName}`;
            item.insertText = fieldName;
            items.push( item );
        }

        return items;
    }

    public getGraphQLArgumentCompletions(
        schema: GraphQLSchemaIndex,
        parentTypeName: string,
        fieldName: string,
        prefix: string
    ): vscode.CompletionItem[] {
        const parentType = schema.types.get( parentTypeName );
        if ( !parentType ) {
            return [];
        }

        const field = parentType.fields.get( fieldName );
        if ( !field?.args?.size ) {
            return [];
        }

        return Array.from( field.args.entries() )
            .filter( ( [ argName ] ) => this.matchesGraphQLPrefix( argName, prefix ) )
            .map( ( [ argName, arg ] ) => {
                const item = new vscode.CompletionItem( argName, vscode.CompletionItemKind.Property );
                item.detail = arg.typeName
                    ? `${fieldName} argument: ${arg.typeName}`
                    : `${fieldName} argument`;
                item.insertText = `${argName}: `;
                return item;
            } );
    }

    public getGraphQLFallbackCompletions( prefix: string ): vscode.CompletionItem[] {
        return [
            new vscode.CompletionItem( "__typename", vscode.CompletionItemKind.Property ),
        ]
            .filter( ( item ) => this.matchesGraphQLPrefix( typeof item.label === "string" ? item.label : item.label.label, prefix ) )
            .map( ( item ) => {
                item.detail = "GraphQL meta field";
                return item;
            } );
    }

    private matchesGraphQLPrefix( candidate: string, prefix: string ): boolean {
        return prefix === "" || candidate.toLowerCase().startsWith( prefix.toLowerCase() );
    }

    private getGraphQLPrefix( document: vscode.TextDocument, position: vscode.Position ): string {
        const linePrefix = document.lineAt( position.line ).text.slice( 0, position.character );
        const match = linePrefix.match( /[_A-Za-z][_0-9A-Za-z]*$/ );
        return match ? match[ 0 ] : "";
    }

    private findGraphQLBlockBounds( document: vscode.TextDocument, position: vscode.Position ): GraphQLBlockBounds | undefined {
        let startLine = -1;

        for ( let line = position.line; line >= 0; line-- ) {
            const trimmed = document.lineAt( line ).text.trim();
            if ( trimmed.startsWith( "```graphql" ) ) {
                startLine = line;
                break;
            }
            if ( trimmed.startsWith( "```" ) && !trimmed.startsWith( "```graphql" ) ) {
                return undefined;
            }
        }

        if ( startLine < 0 ) {
            return undefined;
        }

        for ( let line = position.line + 1; line < document.lineCount; line++ ) {
            if ( document.lineAt( line ).text.trim() === "```" ) {
                return { startLine, endLine: line };
            }
        }

        return { startLine, endLine: document.lineCount - 1 };
    }

}
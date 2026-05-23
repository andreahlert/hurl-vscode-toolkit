import * as vscode from "vscode";
import * as fs from "node:fs";
import * as path from "node:path";
import { HTTP_METHODS } from "../data/methods";
import { COMMON_HEADERS } from "../data/headers";
import { STATUS_CODES } from "../data/statusCodes";
import { SECTIONS } from "../data/sections";
import { ASSERT_PREDICATES, FILTER_FUNCTIONS } from "../data/asserts";
import { OPTIONS } from "../data/options";
import { collectHurlVariableDefinitions, getContextAtPosition } from "../utils/hurlParser";

interface QueryCompletion {
    name: string;
    detail: string;
    snippet: string;
}

interface GraphQLSchemaSymbol {
    name: string;
    detail: string;
    sortText: string;
    kind: vscode.CompletionItemKind;
}

const VARIABLE_NAME_REGEX = /^[A-Za-z][A-Za-z0-9_-]*$/;

const CAPTURE_QUERY_COMPLETIONS: QueryCompletion[] = [
    { name: "status", snippet: "status", detail: "Capture response HTTP status" },
    { name: "version", snippet: "version", detail: "Capture response HTTP version" },
    { name: "url", snippet: "url", detail: "Capture final URL" },
    { name: "redirects", snippet: "redirects", detail: "Capture redirection list" },
    { name: "ip", snippet: "ip", detail: "Capture last connection IP" },
    { name: "header", snippet: "header \"${1:Content-Type}\"", detail: "Capture response header" },
    { name: "certificate", snippet: "certificate \"${1|Subject,Issuer,Start-Date,Expire-Date,Serial-Number,Subject-Alt-Name,Value|}\"", detail: "Capture certificate field" },
    { name: "cookie", snippet: "cookie \"${1:session}\"", detail: "Capture response cookie value/attribute" },
    { name: "body", snippet: "body", detail: "Capture decoded response body" },
    { name: "bytes", snippet: "bytes", detail: "Capture decoded response bytes" },
    { name: "rawbytes", snippet: "rawbytes", detail: "Capture raw response bytes" },
    { name: "xpath", snippet: "xpath \"${1://*}\"", detail: "Capture XPath result" },
    { name: "jsonpath", snippet: "jsonpath \"${1:$.}\"", detail: "Capture JSONPath result" },
    { name: "regex", snippet: "regex /${1:(.+)}/", detail: "Capture first regex group from body" },
    { name: "sha256", snippet: "sha256", detail: "Capture SHA-256 of body" },
    { name: "md5", snippet: "md5", detail: "Capture MD5 of body" },
    { name: "variable", snippet: "variable \"${1:name}\"", detail: "Capture a variable value into another variable" },
    { name: "duration", snippet: "duration", detail: "Capture response duration in ms" },
];

const ASSERT_QUERY_COMPLETIONS: QueryCompletion[] = [
    { name: "status", snippet: "status ${1|==,!=,>,>=,<,<=|} ${2:200}", detail: "Assert HTTP status" },
    { name: "version", snippet: "version ${1:==} \"${2:2}\"", detail: "Assert HTTP version" },
    { name: "url", snippet: "url ${1:==} \"${2:https://example.org}\"", detail: "Assert final URL" },
    { name: "redirects", snippet: "redirects count ${1:==} ${2:1}", detail: "Assert redirections" },
    { name: "ip", snippet: "ip ${1:isIpv4}", detail: "Assert server IP" },
    { name: "header", snippet: "header \"${1:Content-Type}\" ${2:contains} \"${3:application/json}\"", detail: "Assert response header" },
    { name: "certificate", snippet: "certificate \"${1|Subject,Issuer,Start-Date,Expire-Date,Serial-Number,Subject-Alt-Name,Value|}\" ${2:exists}", detail: "Assert TLS certificate field" },
    { name: "cookie", snippet: "cookie \"${1:session}\" ${2:exists}", detail: "Assert response cookie" },
    { name: "body", snippet: "body ${1:contains} \"${2:text}\"", detail: "Assert decoded response body" },
    { name: "bytes", snippet: "bytes ${1:count} ${2:==} ${3:0}", detail: "Assert decoded response bytes" },
    { name: "rawbytes", snippet: "rawbytes ${1:count} ${2:==} ${3:0}", detail: "Assert raw response bytes" },
    { name: "xpath", snippet: "xpath \"${1://*}\" ${2:exists}", detail: "Assert XPath result" },
    { name: "jsonpath", snippet: "jsonpath \"${1:$.}\" ${2:exists}", detail: "Assert JSONPath result" },
    { name: "regex", snippet: "regex /${1:(.+)}/ ${2:==} \"${3:value}\"", detail: "Assert body regex capture" },
    { name: "sha256", snippet: "sha256 ${1:==} hex,${2:abcdef};", detail: "Assert SHA-256 of body" },
    { name: "md5", snippet: "md5 ${1:==} hex,${2:abcdef};", detail: "Assert MD5 of body" },
    { name: "variable", snippet: "variable \"${1:name}\" ${2:exists}", detail: "Assert variable value" },
    { name: "duration", snippet: "duration ${1:<} ${2:1000}", detail: "Assert response duration" },
];

const TEMPLATE_FUNCTIONS = [
    { name: "newDate", detail: "Generate current RFC 3339 UTC date" },
    { name: "newUuid", detail: "Generate UUID v4" },
    { name: "getEnv", detail: "Read an environment variable" },
];

const COOKIE_ATTRIBUTES = [
    "Expires",
    "Max-Age",
    "Domain",
    "Path",
    "Secure",
    "HttpOnly",
    "SameSite",
    "Value",
];

const CERTIFICATE_FIELDS = [
    "Subject",
    "Issuer",
    "Start-Date",
    "Expire-Date",
    "Serial-Number",
    "Subject-Alt-Name",
    "Value",
];

export class HurlCompletionProvider implements vscode.CompletionItemProvider {
    async provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        _token: vscode.CancellationToken,
        _context: vscode.CompletionContext
    ): Promise<vscode.CompletionItem[]> {
        const ctx = getContextAtPosition( document, position );
        const lineText = ctx.lineText;
        const textBeforeCursor = lineText.substring( 0, position.character );
        const items: vscode.CompletionItem[] = [];

        // GraphQL fenced block completions
        if ( this.isInsideFencedBlock( document, position, "graphql" ) ) {
            items.push( ...await this.getGraphQLCompletions() );
            return items;
        }

        if ( textBeforeCursor.endsWith( "{{" ) || textBeforeCursor.match( /\{\{\s*[A-Za-z0-9_-]*$/ ) ) {
            return this.getVariableCompletions( document );
        }

        if ( ctx.context === "method-line" || textBeforeCursor.trim() === "" || textBeforeCursor.match( /^\s*[A-Z]*$/ ) ) {
            if ( lineText.trim() === "" || textBeforeCursor.match( /^\s*[A-Z]*$/ ) ) {
                items.push( ...this.getMethodCompletions() );
            }
        }

        if ( textBeforeCursor.match( /^\s*HTTP\s+\d*$/ ) ) {
            items.push( ...this.getStatusCodeCompletions() );
            return items;
        }

        if ( textBeforeCursor.match( /^\s*\[[A-Za-z]*$/ ) ) {
            items.push( ...this.getSectionCompletions() );
            return items;
        }

        if ( ctx.context === "request-header" && textBeforeCursor.match( /^\s*[\w-]*$/ ) ) {
            items.push( ...this.getHeaderCompletions() );
        }

        const headerValueMatch = textBeforeCursor.match( /^\s*([\w-]+)\s*:\s*(.*)$/ );
        if ( headerValueMatch ) {
            items.push( ...this.getHeaderValueCompletions( headerValueMatch[ 1 ] ) );
            return items;
        }

        if ( ctx.currentSection === "Options" ) {
            if ( textBeforeCursor.match( /^\s*[a-z0-9.-]*$/i ) ) {
                items.push( ...this.getOptionCompletions() );
            }
            if ( textBeforeCursor.match( /^\s*variable\s*:\s*[A-Za-z0-9_-]*$/ ) ) {
                items.push( ...this.getVariableNameCompletions( document, "Known variable" ) );
            }
            return items;
        }

        if ( ctx.currentSection === "Asserts" ) {
            if ( this.isAtQueryStart( textBeforeCursor ) ) {
                items.push( ...this.getQueryCompletions( ASSERT_QUERY_COMPLETIONS ) );
            }
            if ( textBeforeCursor.match( /\bvariable\s+\"[A-Za-z0-9_-]*$/ ) ) {
                items.push( ...this.getVariableNameCompletions( document, "Known variable" ) );
            }
            items.push( ...this.getAssertCompletions( textBeforeCursor ) );
            return items;
        }

        if ( ctx.currentSection === "Captures" ) {
            // Certificate attribute completions when typing inside the certificate query
            if ( /certificate\s+"[^"]*$/.test( textBeforeCursor ) || /certificate\s+"[^"]+"\s*\[.*$/.test( textBeforeCursor ) ) {
                items.push( ...this.getCertificateFieldCompletions() );
                return items;
            }

            // Cookie attribute completions when typing inside a cookie query
            if ( /cookie\s+"[^"]*$/.test( textBeforeCursor ) || /cookie\s+"[^"]+"\s*\[.*$/.test( textBeforeCursor ) ) {
                items.push( ...this.getCookieAttributeCompletions() );
                return items;
            }
            if ( this.isAtCaptureQueryStart( textBeforeCursor ) ) {
                items.push( ...this.getQueryCompletions( CAPTURE_QUERY_COMPLETIONS ) );
            }
            if ( textBeforeCursor.match( /\bvariable\s+\"[A-Za-z0-9_-]*$/ ) ) {
                items.push( ...this.getVariableNameCompletions( document, "Known variable" ) );
            }
            if ( this.looksLikeFilterContext( textBeforeCursor ) ) {
                items.push( ...this.getFilterCompletions() );
            }
            return items;
        }

        return items;
    }

    private getMethodCompletions(): vscode.CompletionItem[] {
        return HTTP_METHODS.map( ( method ) => {
            const item = new vscode.CompletionItem( method.name, vscode.CompletionItemKind.Keyword );
            item.detail = method.description;
            item.insertText = new vscode.SnippetString( `${method.name} \${1:http://localhost:8080/api/}\${0}` );
            item.sortText = `0-${method.name}`;
            return item;
        } );
    }

    private getStatusCodeCompletions(): vscode.CompletionItem[] {
        return STATUS_CODES.map( ( statusCode ) => {
            const item = new vscode.CompletionItem( `${statusCode.code}`, vscode.CompletionItemKind.EnumMember );
            item.detail = `${statusCode.code} ${statusCode.phrase}`;
            item.documentation = statusCode.description;
            item.insertText = `${statusCode.code}`;
            item.filterText = `${statusCode.code} ${statusCode.phrase}`;
            return item;
        } );
    }

    private getSectionCompletions(): vscode.CompletionItem[] {
        return SECTIONS.map( ( section ) => {
            const item = new vscode.CompletionItem( `[${section.name}]`, vscode.CompletionItemKind.Module );
            item.detail = section.canonicalName
                ? `${section.context} section alias for [${section.canonicalName}]`
                : `${section.context} section`;
            item.documentation = section.description;
            item.insertText = new vscode.SnippetString( `[${section.name}]\n\${0}` );
            item.filterText = `[${section.name}]`;
            item.sortText = section.canonicalName ? `1-${section.name}` : `0-${section.name}`;
            return item;
        } );
    }

    private getHeaderCompletions(): vscode.CompletionItem[] {
        return COMMON_HEADERS.map( ( header ) => {
            const item = new vscode.CompletionItem( header.name, vscode.CompletionItemKind.Field );
            item.detail = header.description;
            if ( header.values && header.values.length > 0 ) {
                item.insertText = new vscode.SnippetString( `${header.name}: \${1|${header.values.join( "," )}|}\${0}` );
            } else {
                item.insertText = new vscode.SnippetString( `${header.name}: \${1}\${0}` );
            }
            return item;
        } );
    }

    private getHeaderValueCompletions( headerName: string ): vscode.CompletionItem[] {
        const header = COMMON_HEADERS.find( ( h ) => h.name.toLowerCase() === headerName.toLowerCase() );
        if ( !header?.values ) {
            return [];
        }

        return header.values.map( ( value ) => {
            const item = new vscode.CompletionItem( value, vscode.CompletionItemKind.Value );
            item.insertText = value;
            return item;
        } );
    }

    private getOptionCompletions(): vscode.CompletionItem[] {
        return OPTIONS.map( ( option ) => {
            const item = new vscode.CompletionItem( option.name, vscode.CompletionItemKind.Property );
            item.detail = option.description;

            if ( option.valueType === "boolean" ) {
                item.insertText = new vscode.SnippetString( `${option.name}: \${1|true,false|}\${0}` );
            } else if ( option.valueType === "integer" ) {
                item.insertText = new vscode.SnippetString( `${option.name}: \${1:0}\${0}` );
            } else if ( option.valueType === "duration" ) {
                item.insertText = new vscode.SnippetString( `${option.name}: \${1:500ms}\${0}` );
            } else if ( option.valueType === "string" ) {
                if ( option.name === "variable" ) {
                    item.insertText = new vscode.SnippetString( "variable: ${1:name}=${2:value}${0}" );
                } else {
                    item.insertText = new vscode.SnippetString( `${option.name}: \${1}\${0}` );
                }
            } else {
                item.insertText = option.name;
            }

            return item;
        } );
    }

    private getAssertCompletions( textBeforeCursor: string ): vscode.CompletionItem[] {
        const items: vscode.CompletionItem[] = [];

        if ( this.looksLikePredicateContext( textBeforeCursor ) ) {
            for ( const predicate of ASSERT_PREDICATES ) {
                const item = new vscode.CompletionItem( predicate.name, vscode.CompletionItemKind.Operator );
                item.detail = predicate.description;
                item.documentation = `Example: ${predicate.example}`;
                item.insertText = predicate.name === "not" ? "not " : predicate.name;
                items.push( item );
            }

            items.push( ...this.getFilterCompletions() );
        }

        return items;
    }

    private getQueryCompletions( queries: QueryCompletion[] ): vscode.CompletionItem[] {
        return queries.map( ( query ) => {
            const item = new vscode.CompletionItem( query.name, vscode.CompletionItemKind.Function );
            item.detail = query.detail;
            item.insertText = new vscode.SnippetString( query.snippet );
            return item;
        } );
    }

    private getFilterCompletions(): vscode.CompletionItem[] {
        return FILTER_FUNCTIONS.map( ( filter ) => {
            const item = new vscode.CompletionItem( filter.name, vscode.CompletionItemKind.Function );
            item.detail = filter.description;
            item.documentation = `Example: ${filter.example}`;
            item.insertText = filter.snippet ?? filter.name;
            return item;
        } );
    }

    private getCookieAttributeCompletions(): vscode.CompletionItem[] {
        return COOKIE_ATTRIBUTES.map( ( attr ) => {
            const item = new vscode.CompletionItem( attr, vscode.CompletionItemKind.Field );
            item.detail = `Cookie attribute ${attr}`;
            if ( attr === "Value" ) {
                item.insertText = `[Value]`;
            } else {
                item.insertText = `[${attr}]`;
            }
            return item;
        } );
    }

    private getCertificateFieldCompletions(): vscode.CompletionItem[] {
        return CERTIFICATE_FIELDS.map( ( f ) => {
            const item = new vscode.CompletionItem( f, vscode.CompletionItemKind.Field );
            item.detail = `Certificate field ${f}`;
            item.insertText = `"${f}"`;
            return item;
        } );
    }

    private async getGraphQLCompletions(): Promise<vscode.CompletionItem[]> {
        const keywords = [ "query", "mutation", "subscription", "fragment", "on", "schema" ];
        const items = keywords.map( ( k ) => {
            const it = new vscode.CompletionItem( k, vscode.CompletionItemKind.Keyword );
            it.detail = "GraphQL keyword";
            it.insertText = k;
            return it;
        } );

        const snippet = new vscode.CompletionItem( "GraphQL: query snippet", vscode.CompletionItemKind.Snippet );
        snippet.insertText = new vscode.SnippetString( 'query ${1:Name}(${2:vars}) {\n  ${3:field} {\n    ${4:subfield}\n  }\n}\n' );
        snippet.detail = "Insert GraphQL query skeleton";
        items.unshift( snippet );

        items.push( ...await this.getGraphQLSchemaCompletions() );

        return items;
    }

    private async getGraphQLSchemaCompletions(): Promise<vscode.CompletionItem[]> {
        const files = await vscode.workspace.findFiles( "**/*.graphqls", "**/node_modules/**" );
        const definitions = new Map<string, GraphQLSchemaSymbol>();

        for ( const file of files ) {
            try {
                const bytes = await vscode.workspace.fs.readFile( file );
                const text = new TextDecoder().decode( bytes );
                for ( const symbol of this.extractGraphQLSchemaSymbols( text, path.basename( file.fsPath ) ) ) {
                    if ( !definitions.has( symbol.name ) ) {
                        definitions.set( symbol.name, symbol );
                    }
                }
            } catch {
                continue;
            }
        }

        return Array.from( definitions.values() )
            .sort( ( a, b ) => a.sortText.localeCompare( b.sortText ) || a.name.localeCompare( b.name ) )
            .map( ( symbol ) => {
                const item = new vscode.CompletionItem( symbol.name, symbol.kind );
                item.detail = symbol.detail;
                item.insertText = symbol.name;
                item.sortText = symbol.sortText;
                return item;
            } );
    }

    private extractGraphQLSchemaSymbols( text: string, sourceName: string ): GraphQLSchemaSymbol[] {
        const symbols: GraphQLSchemaSymbol[] = [];
        const seen = new Set<string>();
        const addSymbol = ( name: string, detail: string, sortPrefix: string, kind: vscode.CompletionItemKind ) => {
            if ( seen.has( name ) ) {
                return;
            }

            seen.add( name );
            symbols.push( {
                name,
                detail,
                sortText: `${sortPrefix}-${name}`,
                kind,
            } );
        };

        let currentBlock: "type" | "interface" | "input" | "enum" | undefined;

        for ( const rawLine of text.split( /\r?\n/ ) ) {
            const line = rawLine.trim();
            if ( line === "" || line.startsWith( "#" ) ) {
                continue;
            }

            if ( currentBlock ) {
                if ( line.startsWith( "}" ) ) {
                    currentBlock = undefined;
                    continue;
                }

                if ( currentBlock === "enum" ) {
                    const enumValueMatch = line.match( /^([_A-Za-z][_0-9A-Za-z]*)\b/ );
                    if ( enumValueMatch ) {
                        addSymbol( enumValueMatch[ 1 ], `GraphQL enum value from ${sourceName}`, "3", vscode.CompletionItemKind.EnumMember );
                    }
                    continue;
                }

                const fieldMatch = line.match( /^([_A-Za-z][_0-9A-Za-z]*)\s*(\([^)]*\))?\s*:\s*/ );
                if ( fieldMatch ) {
                    addSymbol( fieldMatch[ 1 ], `GraphQL field from ${sourceName}`, "2", vscode.CompletionItemKind.Field );
                }
                continue;
            }

            const definitionMatch = line.match( /^(type|interface|input|enum|scalar|union)\s+([_A-Za-z][_0-9A-Za-z]*)\b/ );
            if ( definitionMatch ) {
                const definitionKind = definitionMatch[ 1 ];
                const definitionName = definitionMatch[ 2 ];
                const detail = `GraphQL ${definitionKind} from ${sourceName}`;

                if ( definitionKind === "type" || definitionKind === "interface" || definitionKind === "input" ) {
                    addSymbol( definitionName, detail, "0", vscode.CompletionItemKind.Class );
                    currentBlock = definitionKind;
                    continue;
                }

                if ( definitionKind === "enum" ) {
                    addSymbol( definitionName, detail, "0", vscode.CompletionItemKind.Enum );
                    currentBlock = "enum";
                    continue;
                }

                addSymbol( definitionName, detail, "1", vscode.CompletionItemKind.Interface );
            }
        }

        return symbols;
    }

    private isInsideFencedBlock( document: vscode.TextDocument, position: vscode.Position, lang: string ): boolean {
        // Scan upwards to find an opening fence with the language and ensure no closing fence exists before the position
        let inFence = false;
        for ( let i = position.line; i >= 0; i-- ) {
            const text = document.lineAt( i ).text.trim();
            if ( text.startsWith( "```" ) ) {
                if ( text === "```" ) {
                    // generic fence — treat as fence boundary only
                    inFence = !inFence;
                    continue;
                }
                if ( text.startsWith( "```" + lang ) ) {
                    // found opening fence for lang
                    return true;
                }
                // found another fenced block start/stop — stop scanning
                if ( inFence ) return false;
            }
        }

        return false;
    }

    private getVariableCompletions( document: vscode.TextDocument ): vscode.CompletionItem[] {
        const items: vscode.CompletionItem[] = [];

        for ( const variable of this.collectKnownVariables( document ) ) {
            const item = new vscode.CompletionItem( variable.name, vscode.CompletionItemKind.Variable );
            item.detail = variable.detail;
            item.insertText = `${variable.name}}}`;
            item.sortText = variable.sortText;
            items.push( item );
        }

        for ( const func of TEMPLATE_FUNCTIONS ) {
            const item = new vscode.CompletionItem( func.name, vscode.CompletionItemKind.Function );
            item.detail = func.detail;
            if ( func.name === "getEnv" ) {
                item.insertText = "getEnv \"${1:ENV_NAME}\"}}";
            } else {
                item.insertText = `${func.name}}}`;
            }
            item.sortText = `6-${func.name}`;
            items.push( item );
        }

        return items;
    }

    private getVariableNameCompletions( document: vscode.TextDocument, detail: string ): vscode.CompletionItem[] {
        return this.collectKnownVariables( document ).map( ( variable ) => {
            const item = new vscode.CompletionItem( variable.name, vscode.CompletionItemKind.Variable );
            item.detail = detail;
            item.insertText = variable.name;
            item.sortText = variable.sortText;
            return item;
        } );
    }

    private collectKnownVariables( document: vscode.TextDocument ): Array<{ name: string; detail: string; sortText: string }> {
        const knownVariables = new Map<string, { detail: string; sortText: string }>();

        for ( const definition of collectHurlVariableDefinitions( document ) ) {
            if ( !VARIABLE_NAME_REGEX.test( definition.name ) ) {
                continue;
            }

            if ( definition.source === "capture" ) {
                knownVariables.set( definition.name, { detail: "Captured variable", sortText: `0-${definition.name}` } );
            } else if ( definition.source === "option-variable" && !knownVariables.has( definition.name ) ) {
                knownVariables.set( definition.name, { detail: "[Options] variable", sortText: `1-${definition.name}` } );
            } else if ( !knownVariables.has( definition.name ) ) {
                knownVariables.set( definition.name, { detail: "Variable reference", sortText: `3-${definition.name}` } );
            }
        }

        for ( const configured of this.getConfiguredVariables() ) {
            if ( !VARIABLE_NAME_REGEX.test( configured.name ) ) {
                continue;
            }

            if ( !knownVariables.has( configured.name ) ) {
                knownVariables.set( configured.name, {
                    detail: configured.detail,
                    sortText: configured.sortText,
                } );
            }
        }

        return Array.from( knownVariables.entries() )
            .map( ( [ name, info ] ) => ( { name, detail: info.detail, sortText: info.sortText } ) )
            .sort( ( a, b ) => a.sortText.localeCompare( b.sortText ) || a.name.localeCompare( b.name ) );
    }

    private getConfiguredVariables(): Array<{ name: string; detail: string; sortText: string }> {
        const configured: Array<{ name: string; detail: string; sortText: string }> = [];
        const config = vscode.workspace.getConfiguration( "hurl-toolkit" );
        const activeProfileName = config.get<string>( "activeEnvironmentProfile", "" ).trim();
        const profiles = config.get<Record<string, { variables?: Record<string, string>; variablesFile?: string }>>( "environmentProfiles", {} ) ?? {};
        const seen = new Set<string>();

        const collect = ( name: string, detail: string, sortText: string ) => {
            if ( !seen.has( name ) ) {
                seen.add( name );
                configured.push( { name, detail, sortText } );
            }
        };

        for ( const [ envName ] of Object.entries( process.env ) ) {
            if ( envName.startsWith( "HURL_VARIABLE_" ) ) {
                const variableName = envName.replace( "HURL_VARIABLE_", "" );
                if ( VARIABLE_NAME_REGEX.test( variableName ) ) {
                    collect( variableName, "Injected via HURL_VARIABLE_* env", `4-${variableName}` );
                }
            }
        }

        const globalVariablesFile = config.get<string>( "variablesFile", "" ).trim();
        configured.push( ...this.readVariablesFromFile( globalVariablesFile, "Configured variables file", seen ) );

        for ( const [ profileName, profile ] of Object.entries( profiles ) ) {
            for ( const variableName of Object.keys( profile.variables ?? {} ) ) {
                if ( !VARIABLE_NAME_REGEX.test( variableName ) ) {
                    continue;
                }

                const profileSortPrefix = activeProfileName === profileName ? "2" : "5";
                collect( variableName, `Environment profile variable (${profileName})`, `${profileSortPrefix}-${variableName}` );
            }

            if ( activeProfileName === profileName ) {
                configured.push( ...this.readVariablesFromFile( profile.variablesFile ?? "", `Variables file (${profileName})`, seen ) );
            }
        }

        return configured;
    }

    private readVariablesFromFile(
        filePath: string,
        detail: string,
        seen: Set<string>
    ): Array<{ name: string; detail: string; sortText: string }> {
        if ( !filePath ) {
            return [];
        }

        const resolved = this.resolveWorkspacePath( filePath );
        if ( !resolved ) {
            return [];
        }

        try {
            const content = fs.readFileSync( resolved, "utf8" );
            const result: Array<{ name: string; detail: string; sortText: string }> = [];

            for ( const rawLine of content.split( /\r?\n/ ) ) {
                const line = rawLine.trim();
                if ( line === "" || line.startsWith( "#" ) ) {
                    continue;
                }

                const delimiter = line.indexOf( "=" );
                if ( delimiter <= 0 ) {
                    continue;
                }

                const name = line.slice( 0, delimiter ).trim();
                if ( !VARIABLE_NAME_REGEX.test( name ) || seen.has( name ) ) {
                    continue;
                }

                seen.add( name );
                result.push( { name, detail, sortText: `2-${name}` } );
            }

            return result;
        } catch {
            return [];
        }
    }

    private resolveWorkspacePath( inputPath: string ): string | undefined {
        if ( !inputPath ) {
            return undefined;
        }

        if ( path.isAbsolute( inputPath ) ) {
            return inputPath;
        }

        const folder = vscode.workspace.workspaceFolders?.[ 0 ];
        if ( !folder ) {
            return undefined;
        }

        return path.join( folder.uri.fsPath, inputPath );
    }

    private looksLikePredicateContext( textBeforeCursor: string ): boolean {
        return /\S+\s+(".*?"\s*)?$/.test( textBeforeCursor );
    }

    private looksLikeFilterContext( textBeforeCursor: string ): boolean {
        return /\S+\s+(".*?"\s*)?[A-Za-z]*$/.test( textBeforeCursor );
    }

    private isAtCaptureQueryStart( textBeforeCursor: string ): boolean {
        return /^\s*[A-Za-z][A-Za-z0-9_-]*\s*:\s*$/.test( textBeforeCursor ) || this.isAtQueryStart( textBeforeCursor );
    }

    private isAtQueryStart( textBeforeCursor: string ): boolean {
        return textBeforeCursor.trim() === "" || /:\s*$/.test( textBeforeCursor );
    }
}

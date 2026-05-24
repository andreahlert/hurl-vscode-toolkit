import { CompletionItemKind } from "vscode";

export type QueryCompletion = {
    name: string;
    detail: string;
    snippet: string;
}

export type GraphQLOperationType = "query" | "mutation" | "subscription";

export type GraphQLFieldDefinition = {
    typeName?: string;
    args?: Map<string, { typeName?: string }>;
}

export type GraphQLTypeDefinition = {
    kind: "type" | "interface" | "input" | "enum" | "scalar" | "union" | "schema";
    fields: Map<string, GraphQLFieldDefinition>;
    enumValues: string[];
}

export type GraphQLSchemaIndex = {
    types: Map<string, GraphQLTypeDefinition>;
    rootTypes: Partial<Record<GraphQLOperationType, string>>;
}

export type GraphQLCompletionContext = {
    mode: "operation-root" | "selection-set" | "argument";
    prefix: string;
    operationType?: GraphQLOperationType;
    parentTypeName?: string;
    argumentFieldName?: string;
}

export type GraphQLSelectionState = {
    selectionTypeStack: Array<string | undefined>;
    operationType?: GraphQLOperationType;
    insideArguments: boolean;
    argumentFieldName?: string;
}

export type GraphQLBlockBounds = {
    startLine: number;
    endLine: number;
}

export type GraphQLFieldSuggestion = {
    name: string;
    detail: string;
    sortText: string;
    kind: CompletionItemKind;
}

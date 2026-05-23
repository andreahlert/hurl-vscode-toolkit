import * as vscode from "vscode";

export interface HurlEnvironmentProfile {
    hurlPath?: string;
    variablesFile?: string;
    additionalArguments?: string;
    variables?: Record<string, string>;
    environmentVariables?: Record<string, string>;
}

export interface ResolvedHurlRunSettings {
    hurlPath: string;
    args: string[];
    env: NodeJS.ProcessEnv;
    activeEnvironmentLabel: string;
}

const ACTIVE_ENVIRONMENT_KEY = "activeEnvironmentProfile";

export class HurlEnvironmentManager {
    constructor( private readonly context: vscode.ExtensionContext ) { }

    getProfiles(): Record<string, HurlEnvironmentProfile> {
        const config = vscode.workspace.getConfiguration( "hurl-toolkit" );
        return config.get<Record<string, HurlEnvironmentProfile>>( "environmentProfiles", {} ) ?? {};
    }

    getActiveEnvironmentName(): string {
        const workspaceName = this.context.workspaceState.get<string>( ACTIVE_ENVIRONMENT_KEY );
        if ( workspaceName ) {
            return workspaceName;
        }

        const config = vscode.workspace.getConfiguration( "hurl-toolkit" );
        return config.get<string>( "activeEnvironmentProfile", "" ).trim();
    }

    getActiveEnvironmentProfile(): HurlEnvironmentProfile | undefined {
        const profileName = this.getActiveEnvironmentName();
        if ( !profileName ) {
            return undefined;
        }

        return this.getProfiles()[ profileName ];
    }

    getActiveEnvironmentLabel(): string {
        const profileName = this.getActiveEnvironmentName();
        return profileName || "Default";
    }

    async selectEnvironment(): Promise<void> {
        const profiles = this.getProfiles();
        const profileNames = Object.keys( profiles ).sort( ( a, b ) => a.localeCompare( b ) );

        if ( profileNames.length === 0 ) {
            void vscode.window.showInformationMessage(
                "No Hurl environment profiles are configured. Add hurl-toolkit.environmentProfiles in settings first."
            );
            return;
        }

        const selection = await vscode.window.showQuickPick(
            [
                { label: "Default", description: "Use global extension settings and process environment", value: "" },
                ...profileNames.map( ( name ) => ( {
                    label: name,
                    description: this.describeProfile( profiles[ name ] ),
                    value: name,
                } ) ),
            ],
            {
                title: "Select Hurl Environment",
                placeHolder: "Choose the active Hurl environment profile",
            }
        );

        if ( !selection ) {
            return;
        }

        await this.context.workspaceState.update( ACTIVE_ENVIRONMENT_KEY, selection.value || undefined );
    }

    async clearEnvironment(): Promise<void> {
        await this.context.workspaceState.update( ACTIVE_ENVIRONMENT_KEY, undefined );
    }

    resolveRunSettings(): ResolvedHurlRunSettings {
        const config = vscode.workspace.getConfiguration( "hurl-toolkit" );
        const profile = this.getActiveEnvironmentProfile();

        const hurlPath = profile?.hurlPath?.trim() || config.get<string>( "hurlPath", "hurl" );
        const variablesFile = profile?.variablesFile?.trim() || config.get<string>( "variablesFile", "" );
        const additionalArguments = [
            config.get<string>( "additionalArguments", "" ),
            profile?.additionalArguments ?? "",
        ]
            .filter( Boolean )
            .join( " " );

        const args: string[] = [];

        if ( variablesFile ) {
            args.push( "--variables-file", variablesFile );
        }

        if ( profile?.variables ) {
            for ( const [ name, value ] of Object.entries( profile.variables ) ) {
                args.push( "--variable", `${name}=${value}` );
            }
        }

        if ( additionalArguments ) {
            args.push( ...additionalArguments.split( /\s+/ ).filter( Boolean ) );
        }

        return {
            hurlPath,
            args,
            env: {
                ...process.env,
                ...( profile?.environmentVariables ?? {} ),
            },
            activeEnvironmentLabel: this.getActiveEnvironmentLabel(),
        };
    }

    private describeProfile( profile: HurlEnvironmentProfile | undefined ): string {
        if ( !profile ) {
            return "";
        }

        const details: string[] = [];
        if ( profile.variablesFile ) {
            details.push( "variables file" );
        }
        if ( profile.variables && Object.keys( profile.variables ).length > 0 ) {
            details.push( "template variables" );
        }
        if ( profile.environmentVariables && Object.keys( profile.environmentVariables ).length > 0 ) {
            details.push( "process env" );
        }
        if ( profile.additionalArguments ) {
            details.push( "extra args" );
        }

        return details.length > 0 ? details.join( ", " ) : "Uses defaults only";
    }
}
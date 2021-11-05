import * as fs from 'fs';
import * as commandExists from 'command-exists';
import * as vscode from 'vscode';
import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions
} from 'vscode-languageclient/node';
import VFSProvider from './VFSProvider';

enum AcquireErrorConfiguration {
    DisplayAllErrorPopups = 0,
    DisableErrorPopups = 1,
}

interface IDotnetAcquireContext {
    version: string;
    requestingExtensionId?: string;
    errorConfiguration?: AcquireErrorConfiguration;
}

interface IDotnetAcquireResult {
    dotnetPath: string;
}

export async function initLanguageService(context: vscode.ExtensionContext): Promise<LanguageClient|null> {
	// activate language server
	let acquisitionRequest: IDotnetAcquireContext =  { version: "5.0", requestingExtensionId: "gulbanana.thousand" };
	let acquisitionResult = await vscode.commands.executeCommand<IDotnetAcquireResult>('dotnet.acquire', acquisitionRequest);

	let dotnetPath = acquisitionResult!.dotnetPath;
	if (!dotnetPath) {
		let output = vscode.window.createOutputChannel("Thousand Words");
		output.appendLine(".NET runtime installation failed.");
		return null;
	}
	
	// need to acquire this from nuget
	let serverPath = vscode.workspace.getConfiguration("thousand.client").get("serverPath", "C:\\Users\\banana\\Documents\\code\\thousand\\Thousand.LSP"); 
	let serverType = vscode.workspace.getConfiguration("thousand.client").get("serverType", "project");

	if (serverType == "command" && !commandExists.sync(serverPath)) {
		let output = vscode.window.createOutputChannel("Thousand Words");
		output.appendLine("Language server not found. For more features, install https://www.nuget.org/packages/Thousand.LSP/");
		return null;
	} else if (serverType != "command" && !fs.existsSync(serverPath)) {
		let output = vscode.window.createOutputChannel("Thousand Words");
		output.appendLine("Language server not found at " + serverPath);
		return null;
	}
	
	let debugServer = vscode.workspace.getConfiguration("thousand.client").get("debugServer", false);
	let extraArgs = debugServer ? ["launchDebugger"] : [];
	let serverOptions: ServerOptions = {
		run: { 
			command: serverType == "command" ? serverPath : dotnetPath,
			args: (serverType == "project" ? (debugServer ? ["run", "-p", serverPath] : ["run", "-c", "Release", "-p", serverPath]) : []).concat(extraArgs)
		},
		debug: { 
			command: serverType == "command" ? serverPath : dotnetPath,
			args: (serverType == "project" ? ["run", "-p", serverPath] : []).concat(extraArgs)
		}
	};

	let clientOptions: LanguageClientOptions = {
		documentSelector: [{ scheme: "file", language: "thousand" }]
	};

	let client = new LanguageClient(
		"thousand",
		"Thousand Words",
		serverOptions,
		clientOptions
	);

	context.subscriptions.push(client.start());

    // register stdlib provider (readonly files for definitions etc)
    context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider("thousand", new VFSProvider(client)));

    return client;
}
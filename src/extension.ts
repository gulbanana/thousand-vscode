import * as fs from 'fs';
import * as commandExists from 'command-exists';
import * as vscode from 'vscode';
import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	Trace
  } from 'vscode-languageclient/node';

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

export async function activate(context: vscode.ExtensionContext) {
	// activate language server
	let acquisitionRequest: IDotnetAcquireContext =  { version: "5.0", requestingExtensionId: "gulbanana.thousand" };
	let acquisitionResult = await vscode.commands.executeCommand<IDotnetAcquireResult>('dotnet.acquire', acquisitionRequest);

	let dotnetPath = acquisitionResult!.dotnetPath;
	if (!dotnetPath) {
		let output = vscode.window.createOutputChannel("Thousand Words");
		output.appendLine(".NET runtime installation failed.");
		return;
	}
	
	// need to acquire this from nuget
	let serverPath = vscode.workspace.getConfiguration("thousand.client").get("serverPath", "C:\\Users\\banana\\Documents\\code\\thousand\\Thousand.LSP"); 
	let serverType = vscode.workspace.getConfiguration("thousand.client").get("serverType", "project");

	if (serverType == "command" && !commandExists.sync(serverPath)) {
		let output = vscode.window.createOutputChannel("Thousand Words");
		output.appendLine("Language server not found. For more features, install https://www.nuget.org/packages/Thousand.LSP/");
		return;
	} else if (serverType != "command" && !fs.existsSync(serverPath)) {
		let output = vscode.window.createOutputChannel("Thousand Words");
		output.appendLine("Language server not found at " + serverPath);
		return;
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

	// register LSP-dependent commands	
	context.subscriptions.push(vscode.commands.registerCommand('thousand.preview', async () => {
		let installDirectory = vscode.extensions.getExtension("gulbanana.thousand");
		if (!installDirectory) {
			vscode.window.showErrorMessage("Could not find installation location.");
			return;
		}

		vscode.window.showErrorMessage("not yet implemented");
	}));
}

export function deactivate() {}

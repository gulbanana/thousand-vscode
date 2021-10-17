import * as vscode from 'vscode';
import * as fs from 'fs';
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
		vscode.window.showErrorMessage(".NET runtime installation failed.");
		await vscode.commands.executeCommand('dotnet.showAcquisitionLog');
		return;
	}
	
	// need to acquire this from nuget
	let serverPath = vscode.workspace.getConfiguration("thousand.client").get("serverPath", "C:\\Users\\banana\\Documents\\code\\thousand\\Thousand.LSP"); 
	let serverType = vscode.workspace.getConfiguration("thousand.client").get("serverType", "project");

	if (serverType == "command" || fs.existsSync(serverPath)) {
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
	}

	// register commands	
	context.subscriptions.push(vscode.commands.registerCommand('thousand.preview', async () => {
		let installDirectory = vscode.extensions.getExtension("gulbanana.thousand");
		if (!installDirectory) {
			vscode.window.showErrorMessage("Could not find installation location.");
			return;
		}

		vscode.window.showInformationMessage("not implemented");
	}));
}

export function deactivate() {}

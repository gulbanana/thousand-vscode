import * as fs from 'fs';
import * as commandExists from 'command-exists';
import * as vscode from 'vscode';
import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions
} from 'vscode-languageclient/node';
import VFSProvider from './VFSProvider';
import { exec, execFile } from 'child_process';
import { stderr } from 'process';

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

export async function initLanguageService(context: vscode.ExtensionContext, output: vscode.OutputChannel): Promise<LanguageClient|null> {
	let serverType = vscode.workspace.getConfiguration("thousand.client").get("serverType", "project");
	let serverPath = vscode.workspace.getConfiguration("thousand.client").get("serverPath", "thousand-server"); 

	// acquire .NET
	let acquisitionRequest: IDotnetAcquireContext =  { version: "5.0", requestingExtensionId: "gulbanana.thousand" };
	let acquisitionResult = await vscode.commands.executeCommand<IDotnetAcquireResult>('dotnet.acquire', acquisitionRequest);

	let dotnetPath = acquisitionResult!.dotnetPath;
	if (!dotnetPath) {
		output.appendLine(".NET runtime installation failed.");
		return null;
	}

	// acquire Thousand.LSP
	if (serverType == "internal") {
		serverType = "assembly";

		vscode.workspace.fs.createDirectory(context.globalStorageUri);
		let args = [context.asAbsolutePath("out/tool/download-server.dll"), context.globalStorageUri.fsPath];
		let downloadResult = await new Promise<string>((resolve, reject) => {
			execFile(dotnetPath, args, (error, stdout, stderr) => {
				output.append(stderr); // XXX don't batch this
				if (error == null) {
					resolve(stdout);
				} else {
					reject(error);
				}
			});
		});
		serverPath = downloadResult;
	} 
	
	// check prerequisites
	if (serverType == "command" && !commandExists.sync(serverPath)) {
		output.appendLine("Language server not found. Change 'thousand.client.serverType' to 'internal' or install https://www.nuget.org/packages/Thousand.LSP/.");
		return null;
	} else if (serverType != "command" && !fs.existsSync(serverPath)) {
		output.appendLine(`Language server ${serverType} not found at '${serverPath}'.`);
		return null;
	}
	
	let debugServer = vscode.workspace.getConfiguration("thousand.client").get("debugServer", false);
	let extraArgs = [];
	if (serverType != "command") {
		extraArgs.push(serverPath);
	}
	if (debugServer) {
		extraArgs.push("launchDebugger");
	}
	let serverOptions: ServerOptions = {
		run: { 
			command: serverType == "command" ? serverPath : dotnetPath,
			args: (serverType == "project" ? (debugServer ? ["run", "-p"] : ["run", "-c", "Release", "-p"]) : []).concat(extraArgs)
		},
		debug: { 
			command: serverType == "command" ? serverPath : dotnetPath,
			args: (serverType == "project" ? ["run", "-p", serverPath] : []).concat(extraArgs)
		}
	};

	let clientOptions: LanguageClientOptions = {
		documentSelector: [{ scheme: "file", language: "thousand" }],
		outputChannelName: "Thousand Words Log"
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
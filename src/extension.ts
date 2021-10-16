import * as vscode from 'vscode';
import * as child_process from 'child_process';

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
	let acquisitionRequest: IDotnetAcquireContext =  { version: "5.0", requestingExtensionId: "gulbanana.thousand" };
	let acquisition = vscode.commands.executeCommand<IDotnetAcquireResult>('dotnet.acquire', acquisitionRequest);

	let disposable = vscode.commands.registerCommand('thousand.preview', async () => {
		var acquisitionResult = await acquisition;
		let dotnetPath = acquisitionResult!.dotnetPath;
		if (!dotnetPath) {
			vscode.window.showErrorMessage(".NET runtime installation failed.");
			await vscode.commands.executeCommand('dotnet.showAcquisitionLog');
			return;
		}

		let installDirectory = vscode.extensions.getExtension("gulbanana.thousand");
		if (!installDirectory) {
			vscode.window.showErrorMessage("Could not find installation location.");
			return;
		}

		// XXX launch the lsp or preview generator!
		let toolResult = child_process.spawnSync(dotnetPath, ["--info"]);
		vscode.window.showInformationMessage(toolResult.stdout.toString());
	});

	context.subscriptions.push(disposable);
}

export function deactivate() {}

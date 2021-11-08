import * as vscode from 'vscode';
import { initLanguageService } from './language-service';
import { initPreviewPane } from './preview-pane';

export async function activate(context: vscode.ExtensionContext) {
	let previewCommand = vscode.commands.registerCommand("thousand.beginPreview", () => {
        vscode.window.showInformationMessage("Preview unavailable - language server is loading.");
    });

	let output = vscode.window.createOutputChannel("Thousand Words");
	let lspClient = await initLanguageService(context, output);
	
	if (lspClient != null) {
		lspClient.onReady().then(() => initPreviewPane(context, lspClient!, previewCommand));
	} else {
		output.appendLine("Failed to load language server. Code completions and live previews are not available.")
		output.show(true);
		previewCommand.dispose();
		context.subscriptions.push(vscode.commands.registerCommand("thousand.beginPreview", () => {
			vscode.window.showErrorMessage("Preview unavailable - language server failed to load.");
		}));
	}
}

export function deactivate() {}

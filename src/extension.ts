import * as vscode from 'vscode';
import { initLanguageService } from './language-service';
import { initPreviewPane } from './preview-pane';

export async function activate(context: vscode.ExtensionContext) {
	let previewCommand = vscode.commands.registerCommand("thousand.beginPreview", () => {
        vscode.window.showInformationMessage("Preview unavailable - Thousand.LSP is loading.");
    });

	let lspClient = await initLanguageService(context);
	
	if (lspClient != null) {
		lspClient.onReady().then(() => initPreviewPane(context, lspClient!, previewCommand));
	} else {
		previewCommand.dispose();
		context.subscriptions.push(vscode.commands.registerCommand("thousand.beginPreview", () => {
			vscode.window.showErrorMessage("Preview unavailable - Thousand.LSP failed to load.");
		}));
	}
}

export function deactivate() {}

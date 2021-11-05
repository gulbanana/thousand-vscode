import * as vscode from 'vscode';
import { initLanguageService } from './language-service';
import { initPreviewPane } from './preview-pane';

export async function activate(context: vscode.ExtensionContext) {
	let lspClient = await initLanguageService(context);
	
	if (lspClient != null) {
		lspClient.onReady().then(() => initPreviewPane(context, lspClient!));
	}
}

export function deactivate() {}

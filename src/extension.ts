import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
	let disposable = vscode.commands.registerCommand('thousand.preview', () => {
		vscode.window.showInformationMessage('Not yet implemented.');
	});

	context.subscriptions.push(disposable);
}

export function deactivate() {}

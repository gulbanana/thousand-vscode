import * as vscode from 'vscode';
import { LanguageClient } from 'vscode-languageclient/node';

export default class VFSProvider implements vscode.TextDocumentContentProvider {
    onDidChange?: vscode.Event<vscode.Uri> | undefined;
    client: LanguageClient;

    constructor(client: LanguageClient) {
        this.client = client;
    }

    async provideTextDocumentContent(uri: vscode.Uri, token: vscode.CancellationToken): Promise<string> {
        return await this.client.sendRequest<string>("thousand/vfsGet", {path: uri.path}, token);
    }
}
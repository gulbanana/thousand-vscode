import * as vscode from 'vscode';
import { LanguageClient } from "vscode-languageclient/node";
import Preview from './Preview';

let previews = new Map<string, Preview>();
let activePreview : Preview | undefined;

export async function initPreviewPane(context: vscode.ExtensionContext, client: LanguageClient): Promise<void> {
    // add new previews, or update ones which aren't in the background
    client.onNotification("thousand/updatePreview", ({uri, filename}: { uri: string, filename: string }) => {
        let parsedUri = vscode.Uri.parse(uri, true);        

        let preview = previews.get(parsedUri.fsPath);
        if (preview) {
            if (preview == activePreview) {
                preview.reveal();
            }
        } else {
            preview = new Preview(filename, () => {
                previews.delete(parsedUri.fsPath);
            });
            previews.set(parsedUri.fsPath, preview);
        }
        
        preview.setFilename(filename);
    });

    // when a document is added to the workspace, begin previewing it
    context.subscriptions.push(vscode.workspace.onDidOpenTextDocument(doc => {
        if (doc.languageId == "thousand") {
            let preview = previews.get(doc.uri.fsPath);
            if (!preview) {
                client.sendNotification("thousand/beginPreview", {uri: doc.uri.toString()});
            }            
        }
    }));

    // when the document is removed, close its preview (no need to explicitly ask to stop, the server is told it's closed already)
    context.subscriptions.push(vscode.workspace.onDidCloseTextDocument(doc => {
        if (doc.languageId == "thousand") {
            let preview = previews.get(doc.uri.fsPath);
            if (preview) {
                preview.dispose()
            }
        }
    }));

    // when switching tabs, activate that document's preview, or create it anew
    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor && editor.document.languageId == "thousand") {
            let preview = previews.get(editor.document.uri.fsPath);
            if (preview && preview != activePreview) {
                activePreview = preview;
                preview.reveal();
            } else {
                client.sendNotification("thousand/beginPreview", {uri: editor.document.uri.toString()});
            }
        }
    }));

    // upon load of the LSP, open previews for existing documents
    for (let editor of vscode.window.visibleTextEditors) {
        if (editor.document.languageId == "thousand") {
            client.sendNotification("thousand/beginPreview", {uri: editor.document.uri.toString()});
        }
    }
}
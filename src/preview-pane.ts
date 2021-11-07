import * as vscode from 'vscode';
import { LanguageClient, NotificationType } from "vscode-languageclient/node";
import Preview from './Preview';

interface UpdateParams {
	uri: string;
    filename: string;
}

interface BeginEndParams {
	uri: string;
}

export async function initPreviewPane(context: vscode.ExtensionContext, client: LanguageClient, previewCommand: vscode.Disposable): Promise<void> {
    let previews = new Map<string, Preview>();
    let activePreview : Preview | undefined;
    let beginPreview = new NotificationType<BeginEndParams>("thousand/beginPreview");
    let endPreview = new NotificationType<BeginEndParams>("thousand/endPreview");
    let updatePreview = new NotificationType<UpdateParams>("thousand/updatePreview");

    // add new previews or update ones which aren't in the background, then suspend previewing if we close
    client.onNotification(updatePreview, ({uri, filename}) => {
        let parsedUri = vscode.Uri.parse(uri, true);        

        let preview = previews.get(parsedUri.fsPath);
        if (!preview) {
            preview = new Preview(parsedUri, filename, () => {
                client.sendNotification(endPreview, {uri: parsedUri.toString()});
                previews.delete(parsedUri.fsPath);
                if (preview == activePreview) {
                    activePreview = undefined;
                }
            });
            previews.set(parsedUri.fsPath, preview);
            if (!activePreview) {
                activePreview = preview;
            }
        }
        
        preview.update(filename);
    });

    // when a document is added to the workspace, begin previewing it
    context.subscriptions.push(vscode.workspace.onDidOpenTextDocument(doc => {
        if (doc.languageId == "thousand" && vscode.workspace.getConfiguration("thousand.client").get("automaticPreview", true)) {
            let preview = previews.get(doc.uri.fsPath);
            if (!preview) {
                client.sendNotification(beginPreview, {uri: doc.uri.toString()});
            }            
        }
    }));

    // when the document is removed, close its preview
    context.subscriptions.push(vscode.workspace.onDidCloseTextDocument(doc => {
        if (doc.languageId == "thousand") {
            let preview = previews.get(doc.uri.fsPath);
            if (preview) {
                preview.dispose()
            }
        }
    }));

    // when switching tabs, activate that document's preview if it has one
    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor && editor.document.languageId == "thousand") {
            let preview = previews.get(editor.document.uri.fsPath);
            if (preview && preview != activePreview) {
                activePreview = preview;
                preview.reveal();
            }
        }
    }));

    vscode.window.onDidChangeTextEditorSelection(async e => {
        if (e.textEditor.document.languageId == "thousand" && vscode.workspace.getConfiguration("thousand.client").get("highlightSelection", true)) {
            let preview = previews.get(e.textEditor.document.uri.fsPath);
            if (preview) {
                await preview.select(e.textEditor.selection.active);
            }
        }
    });

    // add a command to open previews explicitly
    previewCommand.dispose();
    context.subscriptions.push(vscode.commands.registerCommand("thousand.beginPreview", () => {
        let doc = vscode.window.activeTextEditor?.document;
        if (doc?.languageId == "thousand") {
            client.sendNotification(beginPreview, {uri: doc.uri.toString()});
        }
    }));

    // upon load of the LSP, open previews for existing documents
    if (vscode.workspace.getConfiguration("thousand.client").get("automaticPreview", true)) {
        for (let editor of vscode.window.visibleTextEditors) {
            if (editor.document.languageId == "thousand") {
                client.sendNotification(beginPreview, {uri: editor.document.uri.toString()});
            }
        }
    }
}
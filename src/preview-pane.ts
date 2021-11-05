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

export async function initPreviewPane(context: vscode.ExtensionContext, client: LanguageClient): Promise<void> {
    let previews = new Map<string, Preview>();
    let activePreview : Preview | undefined;
    let beginPreview = new NotificationType<BeginEndParams>("thousand/beginPreview");
    let endPreview = new NotificationType<BeginEndParams>("thousand/endPreview");
    let updatePreview = new NotificationType<UpdateParams>("thousand/updatePreview");

    // add new previews or update ones which aren't in the background, then suspend previewing if we close
    client.onNotification(updatePreview, ({uri, filename}) => {
        let parsedUri = vscode.Uri.parse(uri, true);        

        let preview = previews.get(parsedUri.fsPath);
        if (preview) {
            if (preview == activePreview) {
                preview.reveal();
            }
        } else {
            preview = new Preview(filename, () => {
                client.sendNotification(endPreview, {uri: parsedUri.toString()});
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

    // upon load of the LSP, open previews for existing documents
    for (let editor of vscode.window.visibleTextEditors) {
        if (editor.document.languageId == "thousand") {
            client.sendNotification(beginPreview, {uri: editor.document.uri.toString()});
        }
    }
}
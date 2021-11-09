import { copyFile } from 'fs/promises';
import * as vscode from 'vscode';
import { LanguageClient, NotificationType, RequestType } from "vscode-languageclient/node";
import Preview, { ExportImageParams } from './Preview';

interface UpdateParams {
	uri: string;
    filename: string;
}

interface BeginEndParams {
	uri: string;
}

interface ExportRequest {
    uri: string,
    format: string
}

interface ExportResult {
    filename: string | null
}

export async function initPreviewPane(context: vscode.ExtensionContext, client: LanguageClient, previewCommand: vscode.Disposable): Promise<void> {
    let previews = new Map<string, Preview>();
    let activePreview : Preview | undefined;
    let beginPreview = new NotificationType<BeginEndParams>("thousand/beginPreview");
    let endPreview = new NotificationType<BeginEndParams>("thousand/endPreview");
    let updatePreview = new NotificationType<UpdateParams>("thousand/updatePreview");
    let exportImage = new RequestType<ExportRequest, ExportResult, string>("thousand/exportImage");

    // add new previews or update ones which aren't in the background, then suspend previewing if we close
    client.onNotification(updatePreview, ({uri, filename}) => {
        let parsedUri = vscode.Uri.parse(uri, true);        

        let preview = previews.get(parsedUri.fsPath);
        if (preview) {
            preview.update(filename);
        } else {
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

            preview.update(filename);
            if (vscode.workspace.getConfiguration("thousand.client").get("highlightSelection", true)) {
                preview.selectInitial();
            }
        } 
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

    // when repositioning the cursor, find what symbol it's in and highlight the preview
    context.subscriptions.push(vscode.window.onDidChangeTextEditorSelection(async e => {
        if (e.textEditor.document.languageId == "thousand" && vscode.workspace.getConfiguration("thousand.client").get("highlightSelection", true)) {
            let preview = previews.get(e.textEditor.document.uri.fsPath);
            if (preview) {
                await preview.select(e.textEditor.selection.active);
            }
        }
    }));

    // disable all highlighting when it's turned off
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration("thousand.client")) {
            if (vscode.workspace.getConfiguration("thousand.client").get("highlightSelection", true)) {
                for (let preview of previews.values()) {
                    preview.selectInitial();
                }
            } else {
                for (let preview of previews.values()) {
                    preview.deselect();
                }
            }
        }
    }));

    // add a command to open previews explicitly (or rather, replace the existing dummy command)
    previewCommand.dispose();
    context.subscriptions.push(vscode.commands.registerCommand("thousand.beginPreview", () => {
        let doc = vscode.window.activeTextEditor?.document;
        if (doc?.languageId == "thousand") {
            client.sendNotification(beginPreview, {uri: doc.uri.toString()});
        }
    }));

    // add a command to export from the preview to the filesystem
    context.subscriptions.push(vscode.commands.registerCommand("thousand.export", async (params: ExportImageParams) => {
        let result = await client.sendRequest(exportImage, {uri: params.uri.toString(), format: params.format});
        if (result.filename == null) {
            vscode.window.showErrorMessage("Diagram generation failed.");
            return;
        }

        let loc = params.uri.path.endsWith(".1000") ? params.uri.path.slice(0, params.uri.path.length-5) : params.uri.path;
        let output = await vscode.window.showSaveDialog({
            filters: {[(params.format.toUpperCase() + " image")]: [params.format]},
            defaultUri: params.uri.with({path: loc})
        });
        if (output)
        {
            await copyFile(result.filename, output.fsPath);
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
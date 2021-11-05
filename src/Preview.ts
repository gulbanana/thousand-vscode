import * as path from 'path';
import * as vscode from 'vscode';

export default class Preview {
    seq: number;
    panel: vscode.WebviewPanel;

    constructor(filename: string, disposeListener: () => void) {
        this.seq = 0;

        let filepath = path.parse(filename);
        this.panel = vscode.window.createWebviewPanel('thousandPreview', filepath.base, {
            viewColumn: vscode.ViewColumn.Beside,
            preserveFocus: true
        }, {
            enableFindWidget: false,
            enableScripts: true,
            localResourceRoots: [vscode.Uri.file(filepath.dir)]
        });
        this.panel.onDidDispose(disposeListener);
    }

    setFilename(filename: string) {
        let resourceUri = this.panel.webview.asWebviewUri(vscode.Uri.file(filename));
        this.panel.webview.html = "<html><head><title>" + (this.seq++) + "</title></head><body><img src=\"" + resourceUri + "\"></body></html>";
    }

    reveal() {
        this.panel.reveal(vscode.ViewColumn.Beside, true);
    }

    dispose() {
        this.panel.dispose();
    }
}
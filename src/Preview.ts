import { readFileSync } from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

interface SymbolResult {
    symbol: vscode.DocumentSymbol;
    path: number[];
}

export default class Preview {
    uri: vscode.Uri;
    panel: vscode.WebviewPanel;
    
    seq: number;
    highlightClass: string | null;
    lastResult: SymbolResult | null;

    body: string;
    

    constructor(uri: vscode.Uri, filename: string, disposeListener: () => void) {
        this.uri = uri;

        this.seq = 0;
        this.highlightClass = null;
        this.lastResult = null;

        this.body = "<body></body>";

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
    
    reveal() {
        this.panel.reveal(vscode.ViewColumn.Beside, true);
    }

    update(filename: string) {
        if (filename.endsWith("svg")) {
            let svg = readFileSync(filename);
            this.body = `<body>${svg}</body></html>`;
        } else {
            let resourceUri = this.panel.webview.asWebviewUri(vscode.Uri.file(filename));
            this.body = `<body><img src="${resourceUri}"></body></html>`;
        }
        this.updateImpl();
    }

    async select(pos: vscode.Position) {
        let tree = await vscode.commands.executeCommand("vscode.executeDocumentSymbolProvider", this.uri) as vscode.DocumentSymbol[];
        let result = findSymbol(tree, pos, []);

        if (result?.symbol?.name != this.lastResult?.symbol?.name) {
            this.lastResult = result;

            this.highlightClass = null;
            if (result != null) {
                switch (result.symbol.kind)
                {
                    case vscode.SymbolKind.Class:
                        this.highlightClass = `C_${result.symbol.name}`;
                        break;

                    case vscode.SymbolKind.Variable:
                        if (!result.symbol.name.startsWith("diagram")) {
                            this.highlightClass = `O_${result.path.join("_")}`;
                        }
                        break;
                }
            }    

            this.updateImpl();
        }
    }

    selectInitial() {
        let editor = vscode.window.visibleTextEditors.find(e => e.document.uri.fsPath == this.uri.fsPath);
        if (editor) {
            this.select(editor.selection.active);
        }
    }

    deselect() {
        this.lastResult = null;
        this.highlightClass = null;
        this.updateImpl();
    }

    private updateImpl() {
        let style = this.highlightClass == null ? "" : `<style type="text/css">
    .${this.highlightClass} { 
        filter: contrast(0.5); 
    } 
    .${this.highlightClass}[fill-opacity] { 
        fill-opacity: 0.25; 
    }
</style>`;

        this.panel.webview.html = `<html>
<head><title>${this.uri.path} ${this.seq++}</title>${style}</head>
${this.body}
</html>`;
    }

    dispose() {
        this.panel.dispose();
    }
}

function findSymbol(tree: vscode.DocumentSymbol[], pos: vscode.Position, prefix: number[]) : SymbolResult | null {
    let idx = 0;
    for (let symbol of tree) {
        if (symbol.range.contains(pos)) {
            let path = prefix.concat([idx]);
            return findSymbol(symbol.children, pos, path) ?? {symbol, path};
        }
        if (symbol.kind == vscode.SymbolKind.Variable) {
            idx++;
        }
    }
    return null;
}
import { readFileSync } from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export default class Preview {
    uri: vscode.Uri;
    panel: vscode.WebviewPanel;
    
    seq: number;
    highlightClass: string | null;
    lastSymbol: vscode.DocumentSymbol | null;

    body: string;
    

    constructor(uri: vscode.Uri, filename: string, disposeListener: () => void) {
        this.uri = uri;

        this.seq = 0;
        this.highlightClass = null;
        this.lastSymbol = null;

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
        let symbol = findSymbol(tree, pos);

        if (symbol?.name != this.lastSymbol?.name) {
            this.lastSymbol = symbol;

            this.highlightClass = null;
            if (symbol != null) {
                switch (symbol.kind)
                {
                    case vscode.SymbolKind.Class:
                        this.highlightClass = symbol.name.slice(6);
                        break;
                }
            }    

            this.updateImpl();
        }
    }

    private updateImpl() {
        let style = this.highlightClass == null ? "" : `<style type="text/css">.${this.highlightClass} { filter: contrast(0.5); } .${this.highlightClass}[fill-opacity] { fill-opacity: 0.25; }</style>`;
        this.panel.webview.html = `<html><head><title>${this.uri.path} ${this.seq++}</title>${style}</head>${this.body}</html>`;
    }

    dispose() {
        this.panel.dispose();
    }
}

function findSymbol(tree: vscode.DocumentSymbol[], pos: vscode.Position) : vscode.DocumentSymbol | null {
    for (let sym of tree) {
        if (sym.range.contains(pos)) {
            return findSymbol(sym.children, pos) ?? sym;
        }
    }
    return null;
}
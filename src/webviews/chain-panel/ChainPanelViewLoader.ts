import * as vscode from 'vscode';
import * as path from 'path';

export class ChainPanelViewLoader {

    private panel: (vscode.WebviewPanel | undefined) = undefined;
    private extPath: string = '';
    private context: vscode.ExtensionContext;

    private disposeHandler: ((() => void) | undefined) = undefined;
    private viewStateChangeHandler: ((() => void) | undefined) = undefined;

    constructor(extPath: string, context: vscode.ExtensionContext) {
        this.extPath = extPath;
        this.context = context;
    }

    showView(title: string): vscode.Webview {
        if (!this.panel) {
            this.panel = vscode.window.createWebviewPanel(
                'chain-panel',
                title,
                vscode.ViewColumn.Beside,
                {
                    enableScripts: true,
                    localResourceRoots: [
                        vscode.Uri.file(path.join(this.extPath, "build/chain-panel"))
                    ]
                }
            );

            this.panel.onDidDispose(() => {
                if (this.disposeHandler != undefined) {
                    this.disposeHandler();
                }
                this.panel = undefined;
            }, null, this.context.subscriptions);

            this.panel.onDidChangeViewState(() => {
                if (this.viewStateChangeHandler != undefined) {
                    this.viewStateChangeHandler();
                }
            });

            this.panel.reveal();
            this.update();

            return this.panel.webview;
        } else {
            this.panel.reveal();
			this.update();

            return this.panel.webview;
        }
    }

    update() {
        if (this.panel) {
            const reactAppPathOnDisk = vscode.Uri.file(path.join(this.extPath, "build/chain-panel", "chainPanel.js"));
            const reactAppUri = reactAppPathOnDisk.with({ scheme: "vscode-resource" });
          
            this.panel.webview.html = `
                <!DOCTYPE html>
                <html lang="en">
                    <head>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>Provenance: Blockchain Tools</title>
                        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https:; script-src 'unsafe-eval' 'unsafe-inline' vscode-resource:; style-src vscode-resource: 'unsafe-inline';">
                        <script>
                            window.acquireVsCodeApi = acquireVsCodeApi;
                        </script>
                    </head>
                    <body>
                        <div id="root"></div>
                        <script src="${reactAppUri}"></script>
                    </body>
                </html>
            `;
        }
    }

    onDispose(disposeHandler: (() => void)) {
        this.disposeHandler = disposeHandler;
    }

    onDidChangeViewState(viewStateChangeHandler: (() => void)) {
        this.viewStateChangeHandler = viewStateChangeHandler;
    }

}

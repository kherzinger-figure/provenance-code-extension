import * as vscode from 'vscode';
import { BehaviorSubject } from 'rxjs';

export interface EventData {
}

export enum Command {
    Ready = 'ready'
}

export interface Event {
    command: Command,
    data: EventData | undefined
}

export class ChainViewAppBinding {
    private static instance: ChainViewAppBinding;

    private _webview: (vscode.Webview | undefined) = undefined;
    private _vscode: any = undefined;

    public isReady: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);

    private constructor() { }

    eventListener(event: any) {
        console.dir(event);
        if (event) {
            if (this._webview) {
                this.handleMessageFromReact(event as Event);
            } else {
                this.handleMessageFromCode(event.data as Event);
            }
        }
    }

    unready() {
        this.isReady.next(false);
    }

    waitForReady(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            if (this.isReady.value == true) {
                resolve();
            } else {
                const subscription = this.isReady.subscribe((isReady: boolean) => {
                    if (isReady) {
                        resolve();
                        subscription.unsubscribe();
                    }
                });
            }
        });
    }

    private handleMessageFromReact(event: Event) {
        console.log('Handling message in code from react');
        // TODO
    }

    private handleMessageFromCode(event: Event) {
        console.log('Handling message in react from code');
        // TODO
    }

    public createMarker(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            if (this._vscode) {
                // TODO
            } else {
                reject(new Error('Cannot execute functions from VSCode'));
            }
        });
    }

    public static getCodeInstance(webview: vscode.Webview): ChainViewAppBinding {
        if (!ChainViewAppBinding.instance) {
            ChainViewAppBinding.instance = new ChainViewAppBinding();
        }

        ChainViewAppBinding.instance._webview = webview;
        if (ChainViewAppBinding.instance._webview) {
            ChainViewAppBinding.instance._webview.onDidReceiveMessage((event: any) => {
                ChainViewAppBinding.instance.eventListener(event);
            });
        }

        return ChainViewAppBinding.instance;
    }

    public static getReactInstance(codevs: any = undefined): ChainViewAppBinding {
        if (!ChainViewAppBinding.instance) {
            ChainViewAppBinding.instance = new ChainViewAppBinding();
        }

        if (codevs) {
            ChainViewAppBinding.instance._vscode = codevs;
        }

        return ChainViewAppBinding.instance;
    }

}

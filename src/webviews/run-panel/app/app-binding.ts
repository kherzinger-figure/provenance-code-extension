import * as vscode from 'vscode';
import { v4 as uuidv4 } from 'uuid';
import { BehaviorSubject, Observable } from 'rxjs';

import { SigningKey } from './signing-key';
import { SmartContractFunction } from './smart-contract-function';
import { EmptySmartContractInfo, SmartContractInfo } from './smart-contract-info';

export interface EventData {
}

export enum Alert {
    Primary = 'primary',
    Secondary = 'secondary',
    Success = 'success',
    Danger = 'danger',
    Warning = 'warning',
    Info = 'info',
    Light = 'light',
    Dark = 'dark',
}

export enum Command {
    Ready = 'ready',
    DataChange = 'data-change',
    Alert = 'alert',
    ClearAlerts = 'clear-alerts',
    ExecuteFunctionRequest = 'execute-function-request',
    ExecuteFunctionResponse = 'execute-function-response',
    QueryFunctionRequest = 'query-function-request',
    QueryFunctionResponse = 'query-function-response'
}

export interface Event {
    command: Command,
    data: EventData | undefined
}

export enum DataBinding {
    ContractInfo = 'contractInfo',
    ExecuteFunctions = 'executeFunctions',
    QueryFunctions = 'queryFunctions',
    SigningKeys = "signingKeys"
}

export interface AlertEvent extends EventData {
    id: string,
    type: Alert,
    title: string,
    body: string,
    dismissable: boolean
}

export interface DataChangeEvent extends EventData {
    name: DataBinding,
    value: any
}

export enum ExecuteFunctionResult {
    Success = 'success',
    Error = 'error',
}

export interface ExecuteFunctionRequestEvent extends EventData {
    id: string,
    func: SmartContractFunction,
    args: any,
    key: (string | undefined)
}

export interface ExecuteFunctionResponseEvent extends EventData {
    id: string,
    result: ExecuteFunctionResult,
    data: any,
    error: Error
}

export enum QueryFunctionResult {
    Success = 'success',
    Error = 'error',
}

export interface QueryFunctionRequestEvent extends EventData {
    id: string,
    func: SmartContractFunction,
    args: any
}

export interface QueryFunctionResponseEvent extends EventData {
    id: string,
    result: QueryFunctionResult,
    data: any,
    error: Error
}

export class RunViewAppBinding {
    private static instance: RunViewAppBinding;

    private _webview: (vscode.Webview | undefined) = undefined;
    private _vscode: any = undefined;

    public isReady: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);

    private _contractInfo: BehaviorSubject<SmartContractInfo> = new BehaviorSubject<SmartContractInfo>(EmptySmartContractInfo);
    private _signingKeys: BehaviorSubject<SigningKey[]> = new BehaviorSubject<SigningKey[]>([]);
    private _executeFunctions: BehaviorSubject<SmartContractFunction[]> = new BehaviorSubject<SmartContractFunction[]>([]);
    private _queryFunctions: BehaviorSubject<SmartContractFunction[]> = new BehaviorSubject<SmartContractFunction[]>([]);
    private _alerts: BehaviorSubject<AlertEvent[]> = new BehaviorSubject<AlertEvent[]>([]);

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

    private handleMessageFromReact(event: Event) {
        console.log('Handling message in code from react');
        switch (event.command) {
            case Command.Ready: {
                this.isReady.next(true);
            } break;

            case Command.ExecuteFunctionRequest: {
                const execFuncReq = event.data as ExecuteFunctionRequestEvent;
                console.log(`Received request ${execFuncReq.id} to execute function ${execFuncReq.func.name} as ${execFuncReq.key}`);
                if (this.onExecuteRequestHandler) {
                    this.onExecuteRequestHandler(execFuncReq.func, execFuncReq.args, execFuncReq.key, (result: any) => {
                        this.postExecuteFunctionResponseEvent(execFuncReq.id, ExecuteFunctionResult.Success, result, undefined);
                    }, (err: Error) => {
                        this.postExecuteFunctionResponseEvent(execFuncReq.id, ExecuteFunctionResult.Error, undefined, err);
                    });
                }
            } break;

            case Command.QueryFunctionRequest: {
                const queryFuncReq = event.data as QueryFunctionRequestEvent;
                console.log(`Received request ${queryFuncReq.id} to query function ${queryFuncReq.func.name}`);
                if (this.onQueryRequestHandler) {
                    this.onQueryRequestHandler(queryFuncReq.func, queryFuncReq.args, (result: any) => {
                        this.postQueryFunctionResponseEvent(queryFuncReq.id, QueryFunctionResult.Success, result, undefined);
                    }, (err: Error) => {
                        this.postQueryFunctionResponseEvent(queryFuncReq.id, QueryFunctionResult.Error, undefined, err);
                    });
                }
            } break;
        }
    }

    private handleMessageFromCode(event: Event) {
        console.log('Handling message in react from code');
        switch (event.command) {
            case Command.DataChange: {
                const dataChangeEvent: DataChangeEvent = event.data as DataChangeEvent;
                if (dataChangeEvent.name == DataBinding.ContractInfo) {
                    this._contractInfo.next(dataChangeEvent.value);
                } else if(dataChangeEvent.name == DataBinding.SigningKeys) {
                    this._signingKeys.next(dataChangeEvent.value);
                } else if (dataChangeEvent.name == DataBinding.ExecuteFunctions) {
                    this._executeFunctions.next(dataChangeEvent.value);
                } else if (dataChangeEvent.name == DataBinding.QueryFunctions) {
                    this._queryFunctions.next(dataChangeEvent.value);
                }
            } break;

            case Command.Alert: {
                const alertEvent: AlertEvent = event.data as AlertEvent;
                var newAlerts = this._alerts.value;
                newAlerts.push(alertEvent);
                this._alerts.next(newAlerts);
            } break;

            case Command.ClearAlerts: {
                this._alerts.next([]);
            } break;

            case Command.ExecuteFunctionResponse: {
                const executeFunctionResponseEvent: ExecuteFunctionResponseEvent = event.data as ExecuteFunctionResponseEvent;
                console.dir(executeFunctionResponseEvent);
                if (executeFunctionResponseEvent.id in this.responseHandlers) {
                    this.responseHandlers[executeFunctionResponseEvent.id](executeFunctionResponseEvent);
                }
            } break;

            case Command.QueryFunctionResponse: {
                const queryFunctionResponseEvent: QueryFunctionResponseEvent = event.data as QueryFunctionResponseEvent;
                console.dir(queryFunctionResponseEvent);
                if (queryFunctionResponseEvent.id in this.responseHandlers) {
                    this.responseHandlers[queryFunctionResponseEvent.id](queryFunctionResponseEvent);
                }
            } break;
        }
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

    public clearAlerts() {
        if (this._webview) {
            let event: Event = {
                command: Command.ClearAlerts,
                data: undefined
            };
            this._webview.postMessage(event);
        }
    }

    public clearAlert(id: string) {
        if (this._vscode) {
            var newAlerts = this._alerts.value;
            var idx = newAlerts.findIndex((alert) => {
                return (alert.id == id);
            });
            if (idx >= 0) {
                newAlerts.splice(idx, 1);
            }
            this._alerts.next(newAlerts);
        }
    }

    public showAlert(type: Alert, title: string, body: string, dismissable: boolean) {
        if (this._webview) {
            let event: Event = {
                command: Command.Alert,
                data: {
                    id: uuidv4(),
                    type: type,
                    title: title,
                    body: body,
                    dismissable: dismissable
                }
            };
            this._webview.postMessage(event);
        }
    }

    public set contractInfo(info: SmartContractInfo) {
        this._contractInfo.next(info);
        this.postDataChangeEvent(DataBinding.ContractInfo, this._contractInfo.value);
    }
    public get contractInfo(): SmartContractInfo { return this._contractInfo.value }
    public get contractInfoObservable(): Observable<SmartContractInfo> { return this._contractInfo }

    public set signingKeys(keys: SigningKey[]) {
        this._signingKeys.next(keys);
        this.postDataChangeEvent(DataBinding.SigningKeys, this._signingKeys.value);
    }
    public get signingKeys(): SigningKey[] { return this._signingKeys.value }
    public get signingKeysObservable(): Observable<SigningKey[]> { return this._signingKeys }

    onExecuteRequest(handler: ((func: SmartContractFunction, args: any, key: (string | undefined), resolve: ((result: any) => void), reject: ((err: Error) => void)) => void)) {
        this.onExecuteRequestHandler = handler;
    }
    private onExecuteRequestHandler: ((func: SmartContractFunction, args: any, key: (string | undefined), resolve: ((result: any) => void), reject: ((err: Error) => void)) => void) | undefined = undefined;

    public set executeFunctions(funcs: SmartContractFunction[]) {
        this._executeFunctions.next(funcs);
        this.postDataChangeEvent(DataBinding.ExecuteFunctions, this._executeFunctions.value);
    }
    public get executeFunctions(): SmartContractFunction[] { return this._executeFunctions.value }
    public get executeFunctionsObservable(): Observable<SmartContractFunction[]> { return this._executeFunctions }

    onQueryRequest(handler: ((func: SmartContractFunction, args: any, resolve: ((result: any) => void), reject: ((err: Error) => void)) => void)) {
        this.onQueryRequestHandler = handler;
    }
    private onQueryRequestHandler: ((func: SmartContractFunction, args: any, resolve: ((result: any) => void), reject: ((err: Error) => void)) => void) | undefined = undefined;

    public set queryFunctions(funcs: SmartContractFunction[]) {
        this._queryFunctions.next(funcs);
        this.postDataChangeEvent(DataBinding.QueryFunctions, this._queryFunctions.value);
    }
    public get queryFunctions(): SmartContractFunction[] { return this._queryFunctions.value }
    public get queryFunctionsObservable(): Observable<SmartContractFunction[]> { return this._queryFunctions }

    public get alerts(): AlertEvent[] { return this._alerts.value }
    public get alertsObservable(): Observable<AlertEvent[]> { return this._alerts }

    public executeFunction(func: SmartContractFunction, args: any): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            if (this._vscode) {
                const execFuncReqData: ExecuteFunctionRequestEvent = {
                    id: uuidv4(),
                    func: func,
                    args: args,
                    key: undefined
                };
                const execFuncReqMessage: Event = {
                    command: Command.ExecuteFunctionRequest,
                    data: execFuncReqData
                };
                this.registerResponse(execFuncReqData.id, (eventData: EventData) => {
                    const execFuncResMessage = eventData as ExecuteFunctionResponseEvent;
                    if (execFuncResMessage.result == ExecuteFunctionResult.Success) {
                        resolve(execFuncResMessage.data);
                    } else {
                        reject(execFuncResMessage.error);
                    }
                });
                this._vscode.postMessage(execFuncReqMessage);
            } else {
                reject(new Error('Cannot execute functions from VSCode'));
            }
        });
    }

    public executeFunctionAs(func: SmartContractFunction, args: any, signingKey: string): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            if (this._vscode) {
                const execFuncReqData: ExecuteFunctionRequestEvent = {
                    id: uuidv4(),
                    func: func,
                    args: args,
                    key: signingKey
                };
                const execFuncReqMessage: Event = {
                    command: Command.ExecuteFunctionRequest,
                    data: execFuncReqData
                };
                this.registerResponse(execFuncReqData.id, (eventData: EventData) => {
                    const execFuncResMessage = eventData as ExecuteFunctionResponseEvent;
                    if (execFuncResMessage.result == ExecuteFunctionResult.Success) {
                        resolve(execFuncResMessage.data);
                    } else {
                        reject(execFuncResMessage.error);
                    }
                });
                this._vscode.postMessage(execFuncReqMessage);
            } else {
                reject(new Error('Cannot execute functions from VSCode'));
            }
        });
    }

    public queryFunction(func: SmartContractFunction, args: any): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            if (this._vscode) {
                const queryFuncReqData: QueryFunctionRequestEvent = {
                    id: uuidv4(),
                    func: func,
                    args: args
                };
                const queryFuncReqMessage: Event = {
                    command: Command.QueryFunctionRequest,
                    data: queryFuncReqData
                };
                this.registerResponse(queryFuncReqData.id, (eventData: EventData) => {
                    const queryFuncResMessage = eventData as QueryFunctionResponseEvent;
                    if (queryFuncResMessage.result == QueryFunctionResult.Success) {
                        resolve(queryFuncResMessage.data);
                    } else {
                        reject(queryFuncResMessage.error);
                    }
                });
                this._vscode.postMessage(queryFuncReqMessage);
            } else {
                reject(new Error('Cannot execute functions from VSCode'));
            }
        });
    }

    public static getCodeInstance(webview: vscode.Webview): RunViewAppBinding {
        if (!RunViewAppBinding.instance) {
            RunViewAppBinding.instance = new RunViewAppBinding();
        }

        RunViewAppBinding.instance._webview = webview;
        if (RunViewAppBinding.instance._webview) {
            RunViewAppBinding.instance._webview.onDidReceiveMessage((event: any) => {
                RunViewAppBinding.instance.eventListener(event);
            });
        }

        return RunViewAppBinding.instance;
    }

    public static getReactInstance(codevs: any = undefined): RunViewAppBinding {
        if (!RunViewAppBinding.instance) {
            RunViewAppBinding.instance = new RunViewAppBinding();
        }

        if (codevs) {
            RunViewAppBinding.instance._vscode = codevs;
        }

        return RunViewAppBinding.instance;
    }

    private registerResponse(id: string, handler: ((event: EventData) => void)) {
        this.responseHandlers[id] = handler;
    }
    private responseHandlers: {[k: string]: ((event: EventData) => void)} = {};

    // Event posting helpers VSCode -> React

    private postDataChangeEvent(binding: DataBinding, value: any) {
        if (this._webview) {
            let event: Event = {
                command: Command.DataChange,
                data: {
                    name: binding,
                    value: value
                }
            };
            this._webview.postMessage(event);
        }
    }

    private postExecuteFunctionResponseEvent(id: string, result: ExecuteFunctionResult, data: any, error: (Error | undefined)) {
        if (this._webview) {
            let event: Event = {
                command: Command.ExecuteFunctionResponse,
                data: {
                    id: id,
                    result: result,
                    data: data,
                    error: error
                }
            };
            this._webview.postMessage(event);
        }
    }

    private postQueryFunctionResponseEvent(id: string, result: QueryFunctionResult, data: any, error: (Error | undefined)) {
        if (this._webview) {
            let event: Event = {
                command: Command.QueryFunctionResponse,
                data: {
                    id: id,
                    result: result,
                    data: data,
                    error: error
                }
            };
            this._webview.postMessage(event);
        }
    }

}

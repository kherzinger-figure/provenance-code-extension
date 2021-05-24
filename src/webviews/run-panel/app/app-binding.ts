import * as vscode from 'vscode';
import { v4 as uuidv4 } from 'uuid';
import { BehaviorSubject, Observable } from 'rxjs';

import { SmartContractFunction } from './smart-contract-function';

export interface EventData {
}

export enum Command {
    Ready = 'ready',
    DataChange = 'data-change',
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
    ExecuteFunctions = 'executeFunctions',
    QueryFunctions = 'queryFunctions',
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
    args: any
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

    private _executeFunctions: BehaviorSubject<SmartContractFunction[]> = new BehaviorSubject<SmartContractFunction[]>([]);
    private _queryFunctions: BehaviorSubject<SmartContractFunction[]> = new BehaviorSubject<SmartContractFunction[]>([]);

    /*
    private constructor(webview: (vscode.Webview | undefined), codevs: any) {
        this._webview = webview;
        this._vscode = codevs;
        if (this._webview) {
            this._webview.onDidReceiveMessage((event: any) => {
                this.eventListener(event);
            });
        }
    }
    */

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
                console.log(`Received request ${execFuncReq.id} to execute function ${execFuncReq.func.name}`);
                if (this.onExecuteRequestHandler) {
                    this.onExecuteRequestHandler(execFuncReq.func, execFuncReq.args, (result: any) => {
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
                if (dataChangeEvent.name == DataBinding.ExecuteFunctions) {
                    this._executeFunctions.next(dataChangeEvent.value);
                } else if (dataChangeEvent.name == DataBinding.QueryFunctions) {
                    this._queryFunctions.next(dataChangeEvent.value);
                }
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

    onExecuteRequest(handler: ((func: SmartContractFunction, args: any, resolve: ((result: any) => void), reject: ((err: Error) => void)) => void)) {
        this.onExecuteRequestHandler = handler;
    }
    private onExecuteRequestHandler: ((func: SmartContractFunction, args: any, resolve: ((result: any) => void), reject: ((err: Error) => void)) => void) | undefined = undefined;

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

    public executeFunction(func: SmartContractFunction, args: any): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            if (this._vscode) {
                const execFuncReqData: ExecuteFunctionRequestEvent = {
                    id: uuidv4(),
                    func: func,
                    args: args
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

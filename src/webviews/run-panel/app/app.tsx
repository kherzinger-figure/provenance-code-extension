import * as React from "react";
import './app.scss';

import { Container } from 'react-bootstrap';
import { SmartContractFunction } from './smart-contract-function';
import { RunViewAppBinding, Event, Command } from './app-binding';

import SmartContractInfoView from './smart-contract-info-view';
import SmartContractFunctionsView from './smart-contract-functions-view';

declare global {
    interface Window {
        acquireVsCodeApi(): any
    }
}

const vscode = window.acquireVsCodeApi();

interface AppProps {
}

interface AppState {
    executeFunctions: SmartContractFunction[],
    queryFunctions: SmartContractFunction[]
}

export class App extends React.Component<AppProps, AppState> {

    private appBinding: RunViewAppBinding = RunViewAppBinding.getReactInstance(vscode);

    constructor(props) {
        super(props);

        this.state = {
            executeFunctions: this.appBinding.executeFunctions,
            queryFunctions: this.appBinding.queryFunctions
        }

        this.appBinding.executeFunctionsObservable.subscribe((executeFunctions) => {
            this.setState({
                executeFunctions: executeFunctions
            });
        });

        this.appBinding.queryFunctionsObservable.subscribe((queryFunctions) => {
            this.setState({
                queryFunctions: queryFunctions
            });
        });

        window.addEventListener('message', (event) => {
            this.appBinding.eventListener(event);
        });

        const readyMessage: Event = {
            command: Command.Ready,
            data: undefined
        };
        console.log('POSTING READY EVENT');
        vscode.postMessage(readyMessage);
    }

    render() {
        return (
            <Container className="rootContainer" fluid>
                <SmartContractInfoView></SmartContractInfoView>
                <h2>Execute</h2>
                <hr/>
                <SmartContractFunctionsView functions={this.state.executeFunctions}></SmartContractFunctionsView>
                <br/>
                <h2>Query</h2>
                <hr/>
                <SmartContractFunctionsView functions={this.state.queryFunctions}></SmartContractFunctionsView>
            </Container>
        );
    }

}

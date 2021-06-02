import * as React from "react";
import './app.scss';

import { Container } from 'react-bootstrap';

import { ChainViewAppBinding, Command, Event } from './app-binding';

declare global {
    interface Window {
        acquireVsCodeApi(): any
    }
}

const vscode = window.acquireVsCodeApi();

interface AppProps {
}

interface AppState {
}

export class App extends React.Component<AppProps, AppState> {

    private appBinding: ChainViewAppBinding = ChainViewAppBinding.getReactInstance(vscode);

    constructor(props) {
        super(props);

        // TODO

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
            </Container>
        );
    }

}

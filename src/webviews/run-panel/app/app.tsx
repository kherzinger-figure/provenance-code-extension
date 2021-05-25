import * as React from "react";
import './app.scss';

import { Col, Container, Nav, Row, Tab } from 'react-bootstrap';
import { SmartContractFunction } from './smart-contract-function';
import { RunViewAppBinding, Event, Command } from './app-binding';

import SmartContractInfoView from './smart-contract-info-view';
import SmartContractFunctionView from './smart-contract-function-view';

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
    queryFunctions: SmartContractFunction[],
    activeKey: string
}

export class App extends React.Component<AppProps, AppState> {

    private appBinding: RunViewAppBinding = RunViewAppBinding.getReactInstance(vscode);

    constructor(props) {
        super(props);

        const getDefaultActiveKey = () => {
            if (this.state.executeFunctions.length > 0) {
                console.log(this.state.executeFunctions[0].name);
                return this.state.executeFunctions[0].name;
            } else if (this.state.queryFunctions.length > 0) {
                console.log(this.state.queryFunctions[0].name);
                return this.state.queryFunctions[0].name;
            } else {
                console.log('empty');
                return '';
            }
        };

        this.state = {
            executeFunctions: this.appBinding.executeFunctions,
            queryFunctions: this.appBinding.queryFunctions,
            activeKey: ''
        }

        this.appBinding.executeFunctionsObservable.subscribe((executeFunctions) => {
            this.setState({
                executeFunctions: executeFunctions,
                activeKey: getDefaultActiveKey()
            });
        });

        this.appBinding.queryFunctionsObservable.subscribe((queryFunctions) => {
            this.setState({
                queryFunctions: queryFunctions,
                activeKey: getDefaultActiveKey()
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
        const setActiveKey = (k) => {
            this.setState({ activeKey: k });
        };

        const isActiveKey = (k) => {
            return (this.state.activeKey == k);
        };

        return (
            <Container className="rootContainer" fluid>
                <SmartContractInfoView></SmartContractInfoView>
                <hr/>
                <Tab.Container id="smart-contract-functions" defaultActiveKey={this.state.activeKey} onSelect={setActiveKey}>
					<Row>
						<Col sm={3}>
							<Nav variant="pills" className="flex-column">
								<Nav.Item><Nav.Link disabled>Execute</Nav.Link></Nav.Item>
                                {this.state.executeFunctions.map((func, idx) =>
                                    <Nav.Item>
									    <Nav.Link eventKey={func.name} active={isActiveKey(func.name)}>{func.name}</Nav.Link>
								    </Nav.Item>
                                )}
								<Nav.Item></Nav.Item>
								<Nav.Item><Nav.Link disabled>Query</Nav.Link></Nav.Item>
								{this.state.queryFunctions.map((func, idx) =>
                                    <Nav.Item>
									    <Nav.Link eventKey={func.name} active={isActiveKey(func.name)}>{func.name}</Nav.Link>
								    </Nav.Item>
                                )}
							</Nav>
						</Col>
						<Col sm={9}>
							<Tab.Content>
                                {this.state.executeFunctions.map((func, idx) =>
                                    <Tab.Pane eventKey={func.name} active={isActiveKey(func.name)}>
                                        <SmartContractFunctionView function={func} index={idx}></SmartContractFunctionView>
                                    </Tab.Pane>
                                )}
                                {this.state.queryFunctions.map((func, idx) =>
                                    <Tab.Pane eventKey={func.name} active={isActiveKey(func.name)}>
                                        <SmartContractFunctionView function={func} index={idx}></SmartContractFunctionView>
                                    </Tab.Pane>
                                )}
							</Tab.Content>
						</Col>
					</Row>
				</Tab.Container>
            </Container>
        );
    }

}

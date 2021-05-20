import * as React from "react";
import './smart-contract-function-view.css';

import ReactJson from "react-json-view";
import { FaPlay, FaSpinner } from 'react-icons/fa';
import { Accordion, Card, Form, Button } from 'react-bootstrap';
import SmartContractPropertyView from './smart-contract-property-view';

import Utils from './app-utils';
import { SmartContractFunction, SmartContractFunctionType } from './smart-contract-function';

interface SmartContractFunctionViewProps {
    function: SmartContractFunction,
    index: number
}

interface SmartContractFunctionViewState {
    busy: boolean,
    result: any
}

export default class SmartContractFunctionView extends React.Component<SmartContractFunctionViewProps, SmartContractFunctionViewState> {

    constructor(props: any) {
        super(props);

        this.runSmartContract = this.runSmartContract.bind(this);

        this.state = {
            busy: false,
            result: {}
        }
    }

    _propertyViews: {[k: string]: SmartContractPropertyView} = {};

    render() {
        const index = this.props.index;
        const func = this.props.function;

        const renderRunButtonContents = () => {
            if (!this.state.busy) {
                return <span><FaPlay /> {(func.type == SmartContractFunctionType.Execute) ? "Execute" : "Query"}</span>;
            } else {
                return <span><FaSpinner className="spinner" /> {(func.type == SmartContractFunctionType.Execute) ? "Executing..." : "Querying..."}</span>;
            }
        }

        return (
            <React.Fragment>
                <Card>
                    <Accordion.Toggle as={Card.Header} eventKey={index.toString()}>{Utils.snakeToCamel(func.name)}</Accordion.Toggle>
                    <Accordion.Collapse eventKey={index.toString()}>
                        <Card.Body>
                            <h4>Arguments</h4><hr/>
                            <Form>
                                {this.props.function.properties.map((prop, idx) =>
                                    <SmartContractPropertyView property={prop} index={idx} ref={(c) => { this._propertyViews[prop.name] = c; }}></SmartContractPropertyView>
                                )}
                            </Form>
                            <Button variant={this.state.busy ? "secondary" : "success"} type="button" className="pull-right" disabled={this.state.busy} onClick={this.runSmartContract}>
                                {renderRunButtonContents()}
                            </Button>
                            <h4>Result</h4><hr/>
                            <ReactJson src={this.state.result} theme="ocean" collapsed={2} />
                        </Card.Body>
                    </Accordion.Collapse>
                </Card>
            </React.Fragment>
        );
    }

    private runSmartContract() {
        console.log(`Run smart contract function: ${this.props.function.name}`);

        this.setState({ busy: true });

        // TODO: validate the properties?

        // build the message
        var funcMessage: {[k: string]: any} = {};
        for (var key in this._propertyViews) {
            funcMessage[key] = this._propertyViews[key].toJSON();
        }

        this.setState({ result: {} });

        Utils.runFunction(this.props.function, funcMessage).then((result: any) => {
            this.setState({ busy: false, result: result });
        }).catch((err) => {
            console.log(`Error executing function ${this.props.function.name}: ${err.message}`);
            this.setState({ busy: false, result: {} });
        });
    }

}

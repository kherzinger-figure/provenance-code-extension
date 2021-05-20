import * as React from "react";

import { Accordion } from 'react-bootstrap';
import { SmartContractFunction } from './smart-contract-function';

import SmartContractFunctionView from './smart-contract-function-view';

interface SmartContractFunctionsViewProps {
    functions: SmartContractFunction[]
}

export default class SmartContractFunctionsView extends React.Component<SmartContractFunctionsViewProps> {

    constructor(props: any) {
        super(props);
    }

    render() {
        return (
            <React.Fragment>
                <Accordion>
                    {this.props.functions.map((func, idx) =>
                        <SmartContractFunctionView function={func} index={idx}></SmartContractFunctionView>
                    )}
                </Accordion>
            </React.Fragment>
        );
    }

}

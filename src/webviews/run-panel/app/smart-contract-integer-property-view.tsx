import * as React from "react";
import { Form, Col, Row, InputGroup, Button } from 'react-bootstrap';
import { SmartContractFunctionProperty } from './smart-contract-function';
import { ISmartContractPropertyView } from './smart-contract-property-view';

import './smart-contract-integer-property-view.scss';

const MAX_UINT32 = 4294967295;

interface SmartContractIntegerPropertyViewProps {
    property: SmartContractFunctionProperty,
    index: number
}

export default class SmartContractIntegerPropertyView extends React.Component<SmartContractIntegerPropertyViewProps> implements ISmartContractPropertyView {

    constructor(props: any) {
        super(props);

        this.generateRandom = this.generateRandom.bind(this);
    }

    _input;

    render() {
        const prop = this.props.property;
        //const idx = this.props.index;

        return (
            <React.Fragment>
                <Form.Group as={Row} controlId={prop.name}>
                    <Form.Label column sm={3}>{prop.name}</Form.Label>
                    <Col sm={9}>
                        <InputGroup className="mb-3">
                            <Form.Control type="text" placeholder="" ref={(c) => this._input = c} />
                            <InputGroup.Append>
                                <Button variant="outline-secondary" onClick={this.generateRandom}>Random</Button>
                            </InputGroup.Append>
                        </InputGroup>
                    </Col>
                </Form.Group>
            </React.Fragment>
        );
    }

    private getRandomUInt32() {
        return Math.floor(Math.random() * MAX_UINT32);
    }

    private generateRandom() {
        this._input.value = this.getRandomUInt32().toString();
    }

    isValid(): boolean {
        // TODO
        return true;
    }

    toJSON(): any {
        const value = this._input.value as string;
        return Number(value);
    }

}

import * as React from "react";
import { v4 as uuidv4 } from 'uuid';

import { Form, Col, Row, InputGroup, Button } from 'react-bootstrap';
import { SmartContractFunctionProperty } from './smart-contract-function';

interface SmartContractPropertyViewProps {
    property: SmartContractFunctionProperty,
    index: number
}

export default class SmartContractPropertyView extends React.Component<SmartContractPropertyViewProps> {

    constructor(props: any) {
        super(props);

        this.generateUuid = this.generateUuid.bind(this);
    }

    _input;

    render() {
        //const index = this.props.index;
        const prop = this.props.property;

        return (
            <React.Fragment>
                <Form.Group as={Row} controlId="todo">
                    <Form.Label column sm={2}>{prop.name}</Form.Label>
                    <Col sm={10}>
                        <InputGroup className="mb-3">
                            <Form.Control type="text" placeholder="" ref={(c) => this._input = c} />
                            <InputGroup.Append>
                                <Button variant="outline-secondary" onClick={this.generateUuid}>UUID</Button>
                            </InputGroup.Append>
                        </InputGroup>
                    </Col>
                </Form.Group>
            </React.Fragment>
        );
    }

    private generateUuid() {
        this._input.value = uuidv4();
    }

    isValid(): boolean {
        // TODO
        return false;
    }

    toJSON(): any {
        var json: any;

        const value = this._input.value as string;
        if (this.props.property.type == 'string') {
            json = value;
        } else if (this.props.property.type == 'number') {
            json = Number(value);
        } else if (this.props.property.type == 'integer') {
            json = Number(value);
        } else if (this.props.property.type == 'object') {
            json = {}; // TODO
        } else if (this.props.property.type == 'array') {
            json = []; // TODO
        } else if (this.props.property.type == 'boolean') {
            json = false; // TODO
        } else if (this.props.property.type == 'null') {
            json = null;
        }

        return json;
    }

}

import * as React from "react";
import './smart-contract-info-view.scss';

import { Container, Row, Col } from 'react-bootstrap';

interface SmartContractInfoViewProps {
}

export default class SmartContractInfoView extends React.Component<SmartContractInfoViewProps> {

    constructor(props: any) {
        super(props);
    }

    render() {
        return (
            <React.Fragment>
                <Container className="infoView" fluid>
                    <Row>
                        <Col>
                            <svg color="#3F80F3" width="50px" viewBox="0 0 22 31" fill="none">
                                <path d="M16.5 3.38182L11 0L5.5 3.38182L0 6.76364V12.4V18.0364V27.6182L5.5 31V21.4182L11 24.8L16.5 21.4182L22 18.0364V12.4V6.76364L16.5 3.38182ZM16.5 15.7818L11 19.1636L5.5 15.7818V10.1455L11 6.76364L16.5 10.1455V15.7818Z" fill="currentColor"></path>
                            </svg>
                        </Col>
                        <Col>
                        </Col>
                    </Row>
                </Container>
            </React.Fragment>
        );
    }

}

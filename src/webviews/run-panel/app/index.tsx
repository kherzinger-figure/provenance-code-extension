import * as React from 'react';
import * as ReactDOM from 'react-dom';

import { App } from './app';

import './index.css';
import './theme.scss';
//import 'bootstrap/dist/css/bootstrap.min.css';

ReactDOM.render(
    <App />,
    document.getElementById('root')
);

//============================================================================================================================
// NOTE: The following should perhaps be a separate view?
//============================================================================================================================

// Smart Contract - Contract History
//provenanced query wasm contract-history tp1g6uv2xzfcc4mae8mw6unhdzv9cdy5p62yhndj4 --testnet -o json

// Provenance - Keys
//provenanced keys list --testnet --home /Users/koryherzinger/.provenance/build/node0 -o json
//provenanced keys show node0 --testnet --home /Users/koryherzinger/.provenance/build/node0 -o json

/*
ReactDOM.render(
    <div>
        <div>
            <h1>Smart Contract</h1>
            <hr/>
            <div>
                <h2>Contract History</h2>
            </div>
        </div>
        <div>
            <h1>Provenance</h1>
            <hr/>
            <div>
                <h2>Keys</h2>
            </div>
            <div>
                <h2>Bank Transaction</h2>
            </div>
        </div>
    </div>,
    document.getElementById('root')
);
*/

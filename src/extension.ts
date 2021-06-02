import * as vscode from 'vscode';
import * as glob from 'glob';

import { Utils, SmartContractFunctions } from './utils';
import { Key, Provenance, ProvenanceConfig } from './ProvenanceClient'

import { ChainViewAppBinding } from './webviews/chain-panel/app/app-binding';
import { ChainPanelViewLoader } from './webviews/chain-panel/ChainPanelViewLoader';

import { Alert, RunViewAppBinding } from './webviews/run-panel/app/app-binding';
import { RunPanelViewLoader } from './webviews/run-panel/RunPanelViewLoader';

import { SmartContractFunction } from './webviews/run-panel/app/smart-contract-function';

let provenance: Provenance = new Provenance();
let lastWasmCodeId: number = -1;
let isBusy: boolean = false;

let chainPanelView: ChainPanelViewLoader;
let chainViewApp: ChainViewAppBinding;

let runPanelView: RunPanelViewLoader;
let runViewApp: RunViewAppBinding;

const buildWasmCommand = 'provenance.build';
const chainUtilsCommand = 'provenance.chain-utils';
const compileWasmCommand = 'provenance.compile';
const getKeysCommand = 'provenance.get-keys';
const instantiateOrMigrateWasmCommand = 'provenance.instantiate-or-migrate';
const openTerminalCommand = 'provenance.open-terminal';
const runWasmCommand = 'provenance.run';
const storeWasmCommand = 'provenance.store';

var leftStatusBarSepItem: vscode.StatusBarItem;
var provenanceStatusBarItem: vscode.StatusBarItem;
var compileWasmStatusBarItem: vscode.StatusBarItem;
var buildWasmStatusBarItem: vscode.StatusBarItem;
var runWasmStatusBarItem: vscode.StatusBarItem;
var chainUtilsStatusBarItem: vscode.StatusBarItem;
var openTerminalStatusBarItem: vscode.StatusBarItem;
var rightStatusBarSepItem: vscode.StatusBarItem;

function compileWasm(): Promise<void> {
	const promise = new Promise<void>((resolve, reject) => {
		Utils.loadProvenanceConfig().then((config: ProvenanceConfig) => {
			Utils.runCommand(`make ${config.build.target}`).then(() => {
				resolve();
			}).catch((err) => {
				reject(new Error('Failed to compile WASM'));
			});
		}).catch((err: Error) => {
			reject(err);
		});
	});

	return promise;
}

function storeWasm(): Promise<number> {
	return new Promise<number>((resolve, reject) => {
		Utils.loadProvenanceConfig().then((config: ProvenanceConfig) => {
			var source: string = `https://unknown/url/to/${config.contractLabel}`;

			Utils.getRepoRemoteUrl().then((remoteUrl: string) => {
				source = remoteUrl;
			}).catch((err: Error) => {
			}).finally(() => {
				glob(`artifacts/*.wasm`, { cwd: Utils.getWorkspaceFolder() }, function (err, files) {
					if (err || files == undefined || files.length == 0) {
						reject(new Error('WASM file not found!'));
					} else {
						// TODO: get builder???
						provenance.storeWasm(files[0], source, 'cosmwasm/rust-optimizer:0.10.7').then((codeId: number) => {
							lastWasmCodeId = codeId;
							resolve(codeId);
						}).catch((err: Error) => {
							reject(err);
						});
					}
				});
			});
		});
	});
}

function instantiateOrMigrateWasm(codeId: number): Promise<void> {
	const promise = new Promise<void>((resolve, reject) => {
		// load the provenance config for the project
		Utils.loadProvenanceConfig().then((config: ProvenanceConfig) => {
			// find the latest code id for the contract by its label
			provenance.getLatestCodeIdByContractLabel(config.contractLabel).then((latestCodeId: number) => {
				console.log(`Latest codeId for ${config.contractLabel} is ${latestCodeId}`);
				if (latestCodeId == -1) {
					console.log('Instantiating contract...');

					// setup name binding for the contract
					provenance.bindName(config.binding.name, config.binding.root, false).then(() => {
						// instantiate the contract
						provenance.instantiateWasm(codeId, config.initArgs, config.contractLabel).then(() => {
							resolve();
						}).catch((err: Error) => {
							reject(err);
						});
					}).catch((err) => {
						reject(err);
					});
				} else {
					console.log('Migrating contract...');

					// get the contract info
					const contract = provenance.getContractByCodeId(latestCodeId);
					if (contract) {
						// migrate the contract
						provenance.migrateWasm(contract, codeId).then(() => {
							resolve();
						}).catch((err: Error) => {
							reject(err);
						});
					} else {
						reject(new Error(`Unable to locate contract info by code id ${latestCodeId}`));
					}
				}
			}).catch((err: Error) => {
				reject(err);
			});
		}).catch((err: Error) => {
			reject(err);
		});
	});

	return promise;
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('provenance-smart-contract');

	leftStatusBarSepItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);

	provenanceStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);

	compileWasmStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
	compileWasmStatusBarItem.command = compileWasmCommand;

	buildWasmStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
	buildWasmStatusBarItem.command = buildWasmCommand;

	runWasmStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
	runWasmStatusBarItem.command = runWasmCommand;

	chainUtilsStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
	chainUtilsStatusBarItem.command = chainUtilsCommand;

	openTerminalStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
	openTerminalStatusBarItem.command = openTerminalCommand;

	rightStatusBarSepItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);

	let build = vscode.commands.registerCommand(buildWasmCommand, () => {
		if (isBusy) {
			vscode.window.showWarningMessage('Provenance is currently busy');
		} else {
			isBusy = true;
			compileWasm().then(() => {
				storeWasm().then((codeId: number) => {
					lastWasmCodeId = codeId;
					console.log(`Successfully stored contract with codeId: ${codeId}`);
					instantiateOrMigrateWasm(codeId).then(() => {
						console.log(`Successfully built, stored and instantiated/migrated contract`);
						isBusy = false;
					}).catch((err) => {
						isBusy = false;
						vscode.window.showErrorMessage(err.message);
					});
				}).catch((err) => {
					isBusy = false;
					vscode.window.showErrorMessage(err.message);
				});
			}).catch((err) => {
				isBusy = false;
				vscode.window.showErrorMessage(err.message);
			});
		}
	});

	let compile = vscode.commands.registerCommand(compileWasmCommand, () => {
		if (isBusy) {
			vscode.window.showWarningMessage('Provenance is currently busy');
		} else {
			isBusy = true;
			compileWasm().then(() => {
				console.log(`Successfully compiled contract`);
				isBusy = false;
			}).catch((err) => {
				isBusy = false;
				vscode.window.showErrorMessage(err.message);
			});
		}
	});

	let chainUtils = vscode.commands.registerCommand(chainUtilsCommand, () => {
		console.log('chainUtils 1');
		chainViewApp = ChainViewAppBinding.getCodeInstance(chainPanelView.showView(`Provenance: Blockchain Utils`));
		console.log('chainUtils 2');
		chainPanelView.onDispose(() => {
			console.log('chainPanelView.onDispose');
			chainViewApp.unready();
		});
		chainPanelView.onDidChangeViewState(() => {
			console.log('chainPanelView.onDidChangeViewState');
			updateChainView();
		});

		console.log('chainUtils 3');

		chainViewApp.waitForReady().then(() => {
			console.log('Chain view ready!');
			updateChainView();
		});
	});

	let geyKeys = vscode.commands.registerCommand(getKeysCommand, () => {
		provenance.getKeys().then((keys: Key[]) => {
			console.dir(keys);
		}).catch((err) => {
			vscode.window.showErrorMessage(err.message);
		});
	});

	let instantiateOrMigrate = vscode.commands.registerCommand(instantiateOrMigrateWasmCommand, () => {
		if (isBusy) {
			vscode.window.showWarningMessage('Provenance is currently busy');
		} else {
			isBusy = true;
			instantiateOrMigrateWasm(lastWasmCodeId).then(() => {
				console.log(`Successfully instantiated contract`);
				isBusy = false;
			}).catch((err) => {
				isBusy = false;
				vscode.window.showErrorMessage(err.message);
			});
		}
	});

	let openTerminal = vscode.commands.registerCommand(openTerminalCommand, () => {
		Utils.getTerminal(provenance.settings.clientBinary || "");
	});

	let run = vscode.commands.registerCommand(runWasmCommand, () => {
		Utils.loadProvenanceConfig().then((config: ProvenanceConfig) => {
			runViewApp = RunViewAppBinding.getCodeInstance(runPanelView.showView(`Provenance: ${config.contractLabel}`));
			runPanelView.onDispose(() => {
				console.log('runPanelView.onDispose');
				runViewApp.unready();
			});
			runPanelView.onDidChangeViewState(() => {
				console.log('runPanelView.onDidChangeViewState');
				updateRunView(config);
			});

			runViewApp.waitForReady().then(() => {
				console.log('Run view ready!');
				updateRunView(config);

				// hook up execute function request handler
				runViewApp.onExecuteRequest((func: SmartContractFunction, args: any, key: (string | undefined), resolve: ((result: any) => void), reject: ((err: Error) => void)) => {
					console.log('onExecuteRequest');
					
					var execMsg: {[k: string]: any} = {};
					execMsg[func.name] = args;

					Utils.loadProvenanceConfig().then((config) => {
						provenance.getContractByContractLabel(config.contractLabel).then((contract) => {
							provenance.execute(contract, execMsg, key).then((result: any) => {
								resolve(result);
							}).catch((err) => {
								vscode.window.showErrorMessage(err.message);
								reject(err);
							});
						}).catch((err) => {
							vscode.window.showErrorMessage(err.message);
							reject(err);
						});
					}).catch((err: Error) => {
						vscode.window.showErrorMessage(err.message);
						reject(err);
					});
				});

				// hook up query function request handler
				runViewApp.onQueryRequest((func: SmartContractFunction, args: any, resolve: ((result: any) => void), reject: ((err: Error) => void)) => {
					console.log('onQueryRequest');

					var queryMsg: {[k: string]: any} = {};
					queryMsg[func.name] = args;

					Utils.loadProvenanceConfig().then((config) => {
						provenance.getContractByContractLabel(config.contractLabel).then((contract) => {
							provenance.query(contract, queryMsg).then((result: any) => {
								resolve(result);
							}).catch((err) => {
								vscode.window.showErrorMessage(err.message);
								reject(err);
							});
						}).catch((err) => {
							vscode.window.showErrorMessage(err.message);
							reject(err);
						});
					}).catch((err: Error) => {
						vscode.window.showErrorMessage(err.message);
						reject(err);
					});
				});
			});
		}).catch((err) => {
			vscode.window.showErrorMessage(err.message);
		});
	});

	let store = vscode.commands.registerCommand(storeWasmCommand, () => {
		if (isBusy) {
			vscode.window.showWarningMessage('Provenance is currently busy');
		} else {
			isBusy = true;
			storeWasm().then((codeId: number) => {
				console.log(`Successfully stored contract with codeId: ${codeId}`);
				isBusy = false;
			}).catch((err) => {
				isBusy = false;
				vscode.window.showErrorMessage(err.message);
			});
		}
	});

	context.subscriptions.push(build);
	context.subscriptions.push(chainUtils);
	context.subscriptions.push(compile);
	context.subscriptions.push(geyKeys);
	context.subscriptions.push(instantiateOrMigrate);
	context.subscriptions.push(openTerminal);
	context.subscriptions.push(run);
	context.subscriptions.push(store);

	// register some listener that make sure the status bar 
	// item always up-to-date
	context.subscriptions.push(leftStatusBarSepItem);
	context.subscriptions.push(provenanceStatusBarItem);
	context.subscriptions.push(compileWasmStatusBarItem);
	context.subscriptions.push(buildWasmStatusBarItem);
	context.subscriptions.push(runWasmStatusBarItem);
	context.subscriptions.push(chainUtilsStatusBarItem);
	context.subscriptions.push(openTerminalStatusBarItem);
	context.subscriptions.push(rightStatusBarSepItem);
	context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(updateStatusBar));
	context.subscriptions.push(vscode.window.onDidChangeTextEditorSelection(updateStatusBar));

	// load the settings
	provenance.loadSettings(true);

	// update status bar item once at start
	updateStatusBar();

	// create the Chain View Panel
	chainPanelView = new ChainPanelViewLoader(context.extensionPath, context);

	// create the Run View Panel
	runPanelView = new RunPanelViewLoader(context.extensionPath, context);
}

function updateStatusBar(): void {
	leftStatusBarSepItem.text = '|';
	leftStatusBarSepItem.show();

	provenanceStatusBarItem.text = `Provenance: ${provenance.settings.chainId || '<chain-id not set>'}`;
	provenanceStatusBarItem.show();

	compileWasmStatusBarItem.text = '$(check)';
	compileWasmStatusBarItem.tooltip = 'Compile WASM';
	compileWasmStatusBarItem.show();

	buildWasmStatusBarItem.text = '$(cloud-upload)';
	buildWasmStatusBarItem.tooltip = 'Build, store and instantiate/migrate WASM on Provenance';
	buildWasmStatusBarItem.show();

	runWasmStatusBarItem.text = '$(run)';
	runWasmStatusBarItem.tooltip = 'Run WASM on Provenance';
	runWasmStatusBarItem.show();

	chainUtilsStatusBarItem.text = '$(link)';
	chainUtilsStatusBarItem.tooltip = 'Provenance blockchain utils';
	chainUtilsStatusBarItem.show();

	openTerminalStatusBarItem.text = '$(terminal)';
	openTerminalStatusBarItem.tooltip = 'Open provenanced client terminal';
	openTerminalStatusBarItem.show();

	rightStatusBarSepItem.text = '|';
	rightStatusBarSepItem.show();
}

function updateRunView(config: ProvenanceConfig): void {
	if(runViewApp.isReady) {
		// hide all alerts first
		runViewApp.clearAlerts();

		// get contract info
		provenance.getContractByContractLabel(config.contractLabel).then((contract) => {
			console.log('Setting contract info...');
			runViewApp.contractInfo = {
				name: config.contractLabel,
				address: contract.address,
				codeId: contract.contract_info.code_id
			};
		}).catch((err) => {
			console.log('Contract not found...');
			runViewApp.contractInfo = {
				name: config.contractLabel,
				address: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
				codeId: 0
			};

			runViewApp.showAlert(Alert.Danger, 'Contract not found!', 'Before you can execute the contract, you must first build, store and instantiate it on the Provenance blockchain.', false);
		});

		// get signing keys
		provenance.getKeys().then((keys) => {
			console.log('Setting keys...');
			runViewApp.signingKeys = keys;
		}).catch((err) => {
			vscode.window.showErrorMessage(err.message);
		});

		// load contract function info from JSON schemas
		Utils.loadContractFunctions().then((funcs: SmartContractFunctions) => {
			console.log('Setting contract functions...');
			runViewApp.executeFunctions = funcs.executeFunctions;
			runViewApp.queryFunctions = funcs.queryFunctions;
		}).catch((err) => {
			vscode.window.showErrorMessage(err.message);
		});
	}
}

function updateChainView(): void {
	if(chainViewApp.isReady) {
		// TODO
	}
}

// this method is called when your extension is deactivated
export function deactivate() {}

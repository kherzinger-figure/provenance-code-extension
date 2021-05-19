import * as vscode from 'vscode';
import * as glob from 'glob';

import { Utils } from './utils';
import { Provenance, ProvenanceConfig } from './ProvenanceClient'

let provenance: Provenance = new Provenance();
let lastWasmCodeId: number = -1;
let isBusy: boolean = false;

const buildWasmCommand = 'provenance-code-extension.build';
const compileWasmCommand = 'provenance-code-extension.compile';
const contractInfoCommand = 'provenance-code-extension.contract-info';
const instantiateOrMigrateWasmCommand = 'provenance-code-extension.instantiate-or-migrate';
const openTerminalCommand = 'provenance-code-extension.open-terminal';
const runWasmCommand = 'provenance-code-extension.run';
const storeWasmCommand = 'provenance-code-extension.store';

var leftStatusBarSepItem: vscode.StatusBarItem;
var provenanceStatusBarItem: vscode.StatusBarItem;
var compileWasmStatusBarItem: vscode.StatusBarItem;
var buildWasmStatusBarItem: vscode.StatusBarItem;
var runWasmStatusBarItem: vscode.StatusBarItem;
var showContractInfoStatusBarItem: vscode.StatusBarItem;
var openTerminalStatusBarItem: vscode.StatusBarItem;
var rightStatusBarSepItem: vscode.StatusBarItem;

var runPanel: (vscode.WebviewPanel | undefined);

function loadProvenanceConfig(): Promise<ProvenanceConfig> {
	const promise = new Promise<ProvenanceConfig>((resolve, reject) => {
		vscode.workspace.findFiles('provenance-config.json', '/', 1).then((foundFiles: vscode.Uri[]) => {
			if (foundFiles && foundFiles.length > 0) {
				vscode.workspace.openTextDocument(foundFiles[0]).then((provConfigDoc) => {
					let projectConfig: ProvenanceConfig = JSON.parse(provConfigDoc.getText());
					// TODO: validate projectConfig???
					resolve(projectConfig);
				});
			} else {
				reject(new Error("Workspace does not contain a 'provenance-config.json' file."));
			}
		});
	});
	
	return promise;
}

function compileWasm(): Promise<void> {
	const promise = new Promise<void>((resolve, reject) => {
		Utils.runCommand('make').then(() => {
			resolve();
		}).catch((err) => {
			reject(new Error('Failed to compile WASM'));
		});
	});

	return promise;
}

function storeWasm(): Promise<number> {
	const promise = new Promise<number>((resolve, reject) => {
		glob(`artifacts/*.wasm`, { cwd: Utils.getWorkspaceFolder() }, function (err, files) {
			if (err || files == undefined || files.length == 0) {
				reject(new Error('WASM file not found!'));
			} else {
				provenance.storeWasm(files[0]).then((codeId: number) => {
					lastWasmCodeId = codeId;
					resolve(codeId);
				}).catch((err: Error) => {
					reject(err);
				});
			}
		});
	});

	return promise;
}

function instantiateOrMigrateWasm(codeId: number): Promise<void> {
	const promise = new Promise<void>((resolve, reject) => {
		// load the provenance config for the project
		loadProvenanceConfig().then((config: ProvenanceConfig) => {
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

	showContractInfoStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
	showContractInfoStatusBarItem.command = contractInfoCommand;

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

	let contractInfo = vscode.commands.registerCommand(contractInfoCommand, () => {
		// TODO: show in a window somehow?

		const console = Utils.getConsole();

		loadProvenanceConfig().then((config) => {
			provenance.getContractByContractLabel(config.contractLabel).then((contract) => {
				console.appendLine(`Contract address: ${contract.address}`);
				// TODO
			}).catch((err) => {
				vscode.window.showErrorMessage(err.message);
			});
		}).catch((err: Error) => {
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
		if (!runPanel) {
			loadProvenanceConfig().then((config: ProvenanceConfig) => {
				runPanel = vscode.window.createWebviewPanel(
					'provenance',
					`Provenance: ${config.contractLabel}`,
					vscode.ViewColumn.Beside,
					{}
				);

				runPanel.onDidDispose(() => {
					// TODO

					runPanel = undefined;
				}, null, context.subscriptions);

				runPanel.reveal();
				updateRunPanel();
			}).catch((err) => {
				vscode.window.showErrorMessage(err.message);
			});
		} else {
			runPanel.reveal();
			updateRunPanel();
		}
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
	context.subscriptions.push(compile);
	context.subscriptions.push(contractInfo);
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
	context.subscriptions.push(showContractInfoStatusBarItem);
	context.subscriptions.push(openTerminalStatusBarItem);
	context.subscriptions.push(rightStatusBarSepItem);
	context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(updateStatusBar));
	context.subscriptions.push(vscode.window.onDidChangeTextEditorSelection(updateStatusBar));

	// load the settings
	provenance.loadSettings(true);

	// update status bar item once at start
	updateStatusBar();
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

	showContractInfoStatusBarItem.text = '$(info)';
	showContractInfoStatusBarItem.tooltip = 'Show contract info';
	showContractInfoStatusBarItem.show();

	openTerminalStatusBarItem.text = '$(terminal)';
	openTerminalStatusBarItem.tooltip = 'Open provenanced client terminal';
	openTerminalStatusBarItem.show();

	rightStatusBarSepItem.text = '|';
	rightStatusBarSepItem.show();
}

function updateRunPanel(): void {
	if (runPanel) {
		runPanel.webview.html = '<html><head></head><body><h1>Hi</h1></body></html>';
		// TODO: dynamically generate webview content from json schemas (section for execute and queries)
	}
}

// this method is called when your extension is deactivated
export function deactivate() {}

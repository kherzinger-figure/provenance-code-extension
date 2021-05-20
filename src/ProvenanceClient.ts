import * as vscode from 'vscode';
import * as child_process from 'child_process';
import { Utils } from './utils'

interface ProvenanceNameBindingConfig {
	name: string,
	root: string
}

export interface ProvenanceConfig {
	contractLabel: string
	binding: ProvenanceNameBindingConfig,
	initArgs: any
}

interface ProvenanceLogMessageAttribute {
	key: string,
	value: string
}

interface ProvenanceLogEvent {
	type: string,
	attributes: ProvenanceLogMessageAttribute[]
}

interface ProvenanceLog {
	msg_index: number,
	log: string,
	events: ProvenanceLogEvent[]
}

export interface ProvenanceCodeInfo {
	code_id: number,
	id: number,
	creator: string,
	data_hash: string,
	source: string,
	builder: string
}

export interface ContractInfo {
	code_id: number,
	creator: string,
	admin: string,
	label: string,
	created: string,
	ibc_port_id: string,
	extension: string
}

export interface Contract {
	address: string,
	contract_info: ContractInfo
}

class ProvenanceSettings {
	adminAddress: (string | undefined) = undefined;
	broadcastMode: ('sync' | 'async' | 'block' | undefined) = undefined;
	chainId: (string | undefined) = undefined;
	clientBinary: (string | undefined) = undefined;
	defaultFees: (number | undefined) = 0;
	gasLimit: (number | 'auto' | undefined) = undefined;
	homeDir: (string | undefined) = undefined;
	keyringBackend: (string | undefined) = undefined;
	keyringDirectory: (string | undefined) = undefined;
	nodeHostAddress: (string | undefined) = undefined;
	signingPrivateKey: (string | undefined) = undefined;
	testNet: boolean = false;
}

enum ProvenanceCommand {
	Query = "query",
	TX = "tx",
}

enum TransactionCommand {
	Attribute = "attribute",
	Bank = "bank",
	Broadcast = "broadcast",
	Crisis = "crisis",
	///
	Name = "name",
	WASM = "wasm",
}

enum WASMTransactionCommand {
	ClearContractAdmin = "clear-contract-admin",
	Execute = "execute",
	Instantiate = "instantiate",
	Migrate = "migrate",
	SetContractAdmin = "set-contract-admin",
	Store = "store",
}

enum WASMQueryCommand {
	ContractState = "contract-state"
}

enum WASMContractStateCommand {
	All = "all",
	Raw = "raw",
	Smart = "smart"
}

enum NameTransactionCommand {
	Bind = "bind",
	Delete = "delete"
}

enum ProvenanceClientFlags {
	Admin = "--admin",
	BroadcastMode = "--broadcast-mode",
	ChainId = "--chain-id",
	Fees = "--fees",
	From = "--from",
	Gas = "--gas",
	Home = "--home",
	KeyringBackend = "--keyring-backend",
	KeyringDir = "--keyring-dir",
	Node = "--node",
	TestNet = "--testnet",
	Yes = "--yes"
}

export class Provenance {
	storeWasm(wasmFile: string): Promise<number> {
		// reload the settings
		this.loadSettings();

		// build the command
		const command = this.buildCommand([
			ProvenanceCommand.TX, 
			TransactionCommand.WASM, 
			WASMTransactionCommand.Store, 
			wasmFile
		], {
			"--source": "https://github.com/kherzinger-figure/loan-pool",
			"--builder": "cosmwasm/rust-optimizer:0.10.7",
			"--instantiate-only-address": this.getAddressForKey(this.settings.signingPrivateKey || "")
		}, true);

		const promise = new Promise<number>((resolve, reject) => {
			var codeId: number = -1;

			Utils.runCommand(command, (out: string) => {
				var result = JSON.parse(out);
	
				result.logs.forEach((log: ProvenanceLog) => {
					log.events.forEach((event: ProvenanceLogEvent) => {
						if (event.type == 'message') {
							event.attributes.forEach((attr: ProvenanceLogMessageAttribute) => {
								if (codeId == -1 && attr.key == 'code_id') {
									codeId = Number(attr.value);
								}
							});
						}
					});
				});
			}).then (() => {
				resolve(codeId);
			}).catch((err) => {
				reject(new Error("Failed to store the WASM on provenance"));
			});
		});

		return promise;
	}

	instantiateWasm(codeId: number, initArgs: any, label: string): Promise<void> {
		// reload the settings
		this.loadSettings();

		// build the command
		const command = this.buildCommand([
			ProvenanceCommand.TX, 
			TransactionCommand.WASM, 
			WASMTransactionCommand.Instantiate, 
			codeId.toString(),
			JSON.stringify(initArgs)
		], {
			"--label": `${label}`,
			"--admin": this.settings.adminAddress || this.getAddressForKey(this.settings.signingPrivateKey || "")
		}, true);

		const promise = new Promise<void>((resolve, reject) => {
			Utils.runCommand(command).then (() => {
				resolve();
			}).catch((err) => {
				reject(new Error("Failed to instantiate the contract"));
			});
		});

		return promise;
	}

	migrateWasm(contract: Contract, newCodeId: number): Promise<void> {
		// reload the settings
		this.loadSettings();

		// build the command
		const command = this.buildCommand([
			ProvenanceCommand.TX, 
			TransactionCommand.WASM, 
			WASMTransactionCommand.Migrate, 
			contract.address,
			newCodeId.toString(),
			JSON.stringify({ "migrate": { } })
		], {}, true);

		/*
		build/provenanced tx wasm migrate tp18vd8fpwxzck93qlwghaj6arh4p7c5n89x8kskz CODE_ID \
			'{"migrate":{}}' \
			--from validator \
			--keyring-backend test \
			--home build/run/provenanced \
			--chain-id testing \
			--gas auto \
			--gas-adjustment 1.4 \
			--fees 6000nhash \
			--broadcast-mode block \
			--yes \
			--testnet | jq
		*/

		const promise = new Promise<void>((resolve, reject) => {
			Utils.runCommand(command).then (() => {
				resolve();
			}).catch((err) => {
				reject(new Error("Failed to migrate the contract"));
			});
		});

		return promise;
	}

	bindName(name: string, root: string, restrictChildCreation: boolean = true): Promise<void> {
		// reload the settings
		this.loadSettings();

		// build the command
		const command = this.buildCommand([
			ProvenanceCommand.TX, 
			TransactionCommand.Name, 
			NameTransactionCommand.Bind, 
			name,
			this.getAddressForKey(this.settings.signingPrivateKey || ""),
			root,
			`--restrict=${restrictChildCreation ? 'true' : 'false'}`
		], {}, true);

		const promise = new Promise<void>((resolve, reject) => {
			let already_bound = false;
			Utils.runCommand(command, undefined, (err: (string | Buffer)) => {
				if (err.toString().includes('name is already bound')) {
					already_bound = true;
				}
			}).then (() => {
				resolve();
			}).catch((err) => {
				if (already_bound) {
					resolve();
				} else {
					reject(new Error("Failed to bind name"));
				}
			});
		});

		return promise;
	}

	execute(contract: Contract, execMsg: any): Promise<any> {
		const promise = new Promise<void>((resolve, reject) => {
			// reload the settings
			this.loadSettings();

			// build the command
			const command = this.buildCommandArray([
				ProvenanceCommand.TX, 
				TransactionCommand.WASM, 
				WASMTransactionCommand.Execute, 
				contract.address,
				`${JSON.stringify(execMsg)}`
			], {}, true);

			let result: any = {};
			let result_data: string = '';
			Utils.runCommandWithArray(command, (data: string) => {
				result_data = result_data + data;
			}).then (() => {
				result = JSON.parse(result_data);
				resolve(result);
			}).catch((err) => {
				reject(new Error("Failed to execute the contract"));
			});
		});

		return promise
	}

	query(contract: Contract, queryMsg: any): Promise<any> {
		const promise = new Promise<void>((resolve, reject) => {
			// reload the settings
			this.loadSettings();

			// build the command
			const command = this.buildCommand([
				ProvenanceCommand.Query, 
				TransactionCommand.WASM, 
				WASMQueryCommand.ContractState, 
				WASMContractStateCommand.Smart,
				contract.address,
				`${JSON.stringify(queryMsg)}`
			], {
				'-o': 'json'
			}, false, true);

			let result: any = {};
			let result_data: string = '';
			Utils.runCommand(command, (data: string) => {
				result_data = result_data + data;
			}).then (() => {
				result = JSON.parse(result_data);
				resolve(result);
			}).catch((err) => {
				reject(new Error("Failed to query the contract"));
			});
		});

		return promise
	}

	getAddressForKey(key: string): string {
		const address = child_process.execSync(`${this.settings.clientBinary || 'provenanced'} keys show -a ${key} --home ${this.settings.homeDir} ${this.settings.testNet ? ProvenanceClientFlags.TestNet : ''}`);
		return address.toString().trim();
	}

	getLatestCodeIdByContractLabel(label: string): Promise<number> {
		const promise = new Promise<number>((resolve, reject) => {
			// reload the settings
			this.loadSettings();

			let latestCodeId: number = -1;

			const codeList = child_process.execSync(`${this.settings.clientBinary || 'provenanced'} query wasm list-code -o json`);
			const codeInfos: ProvenanceCodeInfo[] = JSON.parse(codeList.toString()).code_infos;
			if (codeInfos) {
				codeInfos.forEach((codeInfo: ProvenanceCodeInfo) => {
					//console.dir(codeInfo);
					const contractList = child_process.execSync(`${this.settings.clientBinary || 'provenanced'} query wasm list-contract-by-code ${codeInfo.code_id ? codeInfo.code_id : codeInfo.id} -o json`);
					const contractAddresses: string[] = JSON.parse(contractList.toString()).contracts;
					if (contractAddresses) {
						contractAddresses.forEach((contractAddress: string) => {
							//console.dir(contractAddress);
							const contractData = child_process.execSync(`${this.settings.clientBinary || 'provenanced'} query wasm contract ${contractAddress} ${this.settings.testNet ? ProvenanceClientFlags.TestNet : ''} -o json`);
							const contract: Contract = JSON.parse(contractData.toString());
							//console.dir(contract);

							if (contract.contract_info.label == label) {
								latestCodeId = (contract.contract_info.code_id > latestCodeId ? contract.contract_info.code_id : latestCodeId);
							}
						})
					}
				});

				resolve(latestCodeId);
			} else {
				resolve(-1);
			}
		});

		return promise;
	}

	getContractByCodeId(codeId: number): (Contract | undefined) {
		let foundContract = undefined;

		const contractList = child_process.execSync(`${this.settings.clientBinary || 'provenanced'} query wasm list-contract-by-code ${codeId} -o json`);
		const contractAddresses: string[] = JSON.parse(contractList.toString()).contracts;
		if (contractAddresses) {
			contractAddresses.forEach((contractAddress: string) => {
				const contractData = child_process.execSync(`${this.settings.clientBinary || 'provenanced'} query wasm contract ${contractAddress} ${this.settings.testNet ? ProvenanceClientFlags.TestNet : ''} -o json`);
				const contract: Contract = JSON.parse(contractData.toString());

				if (contract.contract_info.code_id == codeId) {
					foundContract = contract;
				}
			});
		}

		return foundContract;
	}

	getContractByContractLabel(label: string): Promise<Contract> {
		const promise = new Promise<Contract>((resolve, reject) => {
			// reload the settings
			this.loadSettings();

			let foundContract: (Contract | undefined) = undefined;

			const codeList = child_process.execSync(`${this.settings.clientBinary || 'provenanced'} query wasm list-code -o json`);
			const codeInfos: ProvenanceCodeInfo[] = JSON.parse(codeList.toString()).code_infos;
			if (codeInfos) {
				codeInfos.forEach((codeInfo: ProvenanceCodeInfo) => {
					//console.dir(codeInfo);
					const contractList = child_process.execSync(`${this.settings.clientBinary || 'provenanced'} query wasm list-contract-by-code ${codeInfo.code_id ? codeInfo.code_id : codeInfo.id} -o json`);
					const contractAddresses: string[] = JSON.parse(contractList.toString()).contracts;
					if (contractAddresses) {
						contractAddresses.forEach((contractAddress: string) => {
							//console.dir(contractAddress);
							const contractData = child_process.execSync(`${this.settings.clientBinary || 'provenanced'} query wasm contract ${contractAddress} ${this.settings.testNet ? ProvenanceClientFlags.TestNet : ''} -o json`);
							const contract: Contract = JSON.parse(contractData.toString());
							//console.dir(contract);

							if (contract.contract_info.label == label) {
								foundContract = contract;
							}
						})
					}
				});

				if (foundContract) {
					resolve(foundContract);
				} else {
					reject(new Error(`Unable to locate contract '${label}'`));
				}
			} else {
				reject(new Error(`Unable to locate contract '${label}'`));
			}
		});

		return promise;
	}

	private buildCommand(commands: string[], args: any = {}, skipPrompt: boolean = true, isQuery: boolean = false): string {
		return this.buildCommandArray(commands, args, skipPrompt, isQuery).join(' ');
	}

	private buildCommandArray(commands: string[], args: any = {}, skipPrompt: boolean = true, isQuery: boolean = false): string[] {
		let cmd: string[] = [];

		// the provenanced client
		cmd.push(this.settings.clientBinary || 'provenanced');

		// add the base command and the subcommands
		commands.forEach((command) => {
			cmd.push(command);
		});

		// add the subcommand specific arguments
		for (let key in args) {
			/*
			cmd.push(`${key} ${args[key]}`);
			*/
			cmd.push(key);
			cmd.push(args[key]);
		}

		// add the generic arguments
		/*
		if (!isQuery) {
			if (this.settings.adminAddress) { cmd.push(`${ProvenanceClientFlags.Admin} ${this.settings.adminAddress}`); }
			if (this.settings.broadcastMode) { cmd.push(`${ProvenanceClientFlags.BroadcastMode} ${this.settings.broadcastMode}`); }
		}
		if (this.settings.chainId) { cmd.push(`${ProvenanceClientFlags.ChainId} ${this.settings.chainId}`); }
		if (!isQuery) {
			if (this.settings.defaultFees) { cmd.push(`${ProvenanceClientFlags.Fees} ${this.settings.defaultFees.toString()}nhash`); } // TODO: only for TX?
			if (this.settings.gasLimit) { cmd.push(`${ProvenanceClientFlags.Gas} ${this.settings.gasLimit}`); }
		}
		if (this.settings.homeDir) { cmd.push(`${ProvenanceClientFlags.Home} ${this.settings.homeDir}`); }
		if (!isQuery) {
			if (this.settings.keyringBackend) { cmd.push(`${ProvenanceClientFlags.KeyringBackend} ${this.settings.keyringBackend}`); }
			if (this.settings.keyringDirectory) { cmd.push(`${ProvenanceClientFlags.KeyringDir} ${this.settings.keyringDirectory}`); }
		}
		if (this.settings.nodeHostAddress) { cmd.push(`${ProvenanceClientFlags.Node} ${this.settings.nodeHostAddress}`); }
		if (!isQuery) {
			if (this.settings.signingPrivateKey) { cmd.push(`${ProvenanceClientFlags.From} ${this.settings.signingPrivateKey}`); }
		}
		*/
		if (!isQuery) {
			if (this.settings.adminAddress) { cmd.push(ProvenanceClientFlags.Admin); cmd.push(this.settings.adminAddress); }
			if (this.settings.broadcastMode) { cmd.push(ProvenanceClientFlags.BroadcastMode); cmd.push(this.settings.broadcastMode); }
		}
		if (this.settings.chainId) { cmd.push(ProvenanceClientFlags.ChainId); cmd.push(this.settings.chainId); }
		if (!isQuery) {
			if (this.settings.defaultFees) { cmd.push(ProvenanceClientFlags.Fees); cmd.push(`${this.settings.defaultFees.toString()}nhash`); } // TODO: only for TX?
			if (this.settings.gasLimit) { cmd.push(ProvenanceClientFlags.Gas); cmd.push(this.settings.gasLimit.toString()); }
		}
		if (this.settings.homeDir) { cmd.push(ProvenanceClientFlags.Home); cmd.push(this.settings.homeDir); }
		if (!isQuery) {
			if (this.settings.keyringBackend) { cmd.push(ProvenanceClientFlags.KeyringBackend); cmd.push(this.settings.keyringBackend); }
			if (this.settings.keyringDirectory) { cmd.push(ProvenanceClientFlags.KeyringDir); cmd.push(this.settings.keyringDirectory); }
		}
		if (this.settings.nodeHostAddress) { cmd.push(ProvenanceClientFlags.Node); cmd.push(this.settings.nodeHostAddress); }
		if (!isQuery) {
			if (this.settings.signingPrivateKey) { cmd.push(ProvenanceClientFlags.From); cmd.push(this.settings.signingPrivateKey); }
		}

		// add flags
		if (this.settings.testNet) { cmd.push(ProvenanceClientFlags.TestNet); }
		if (skipPrompt && !isQuery) { cmd.push(ProvenanceClientFlags.Yes); }

		return cmd;
	}

	loadSettings(dumpToConsole: boolean = false) {
		const config = vscode.workspace.getConfiguration('provenance') || <any>{};
		this.settings.adminAddress = config.get('adminAddress');
		this.settings.broadcastMode = config.get('broadcastMode');
		this.settings.chainId = config.get('chainId');
		this.settings.clientBinary = config.get('clientBinary');
		this.settings.defaultFees = config.get('defaultFees');
		this.settings.gasLimit = config.get('gasLimit');
		this.settings.homeDir = config.get('homeDir');
		this.settings.keyringBackend = config.get('keyringBackend');
		this.settings.keyringDirectory = config.get('keyringDirectory');
		this.settings.nodeHostAddress = config.get('nodeHostAddress');
		this.settings.signingPrivateKey = config.get('signingPrivateKey')
		this.settings.testNet = config.get('testNet') || false;

		if (dumpToConsole) {
			console.log('Provenance Settings:');
			console.log(`  provenance.adminAddress = ${this.settings.adminAddress || "<unset>"}`);
			console.log(`  provenance.broadcastMode = ${this.settings.broadcastMode || "<unset>"}`);
			console.log(`  provenance.chainId = ${this.settings.chainId || "<unset>"}`);
			console.log(`  provenance.clientBinary = ${this.settings.clientBinary || "<unset>"}`);
			console.log(`  provenance.defaultFees = ${this.settings.defaultFees?.toString() || "<unset>"}`);
			console.log(`  provenance.gasLimit = ${this.settings.gasLimit || "<unset>"}`);
			console.log(`  provenance.homeDir = ${this.settings.homeDir || "<unset>"}`);
			console.log(`  provenance.keyringBackend = ${this.settings.keyringBackend || "<unset>"}`);
			console.log(`  provenance.keyringDirectory = ${this.settings.keyringDirectory || "<unset>"}`);
			console.log(`  provenance.nodeHostAddress = ${this.settings.nodeHostAddress || "<unset>"}`);
			console.log(`  provenance.signingPrivateKey = ${this.settings.signingPrivateKey || "<unset>"}`);
			console.log(`  provenance.testNet = ${this.settings.testNet.toString() || "<unset>"}`);
		}
	}

	settings: ProvenanceSettings = new ProvenanceSettings();
}
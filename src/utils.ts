import * as vscode from 'vscode';
import * as child_process from 'child_process';
import * as path from 'path';

const TERMINAL_NAME = "provenanced";

let OutputChannel: (vscode.OutputChannel | null) = null;

export class Utils {

    static getTerminal(pathToProvenancedBin: string): vscode.Terminal {
        var terminal = null;
        vscode.window.terminals.forEach((term: vscode.Terminal) => {
            if (term.name == TERMINAL_NAME) {
                terminal = term;
            }
        });
        if (terminal == null) {
            const clientBinaryDir = path.dirname(pathToProvenancedBin);

            let envVars: any = process.env;
            if (clientBinaryDir && !envVars.PATH.includes(`:${clientBinaryDir}`)) {
                envVars.PATH = `${envVars.PATH}:${clientBinaryDir}`
            }
            console.log(`PATH=${envVars.PATH}`)

            terminal = vscode.window.createTerminal({
                cwd: Utils.getWorkspaceFolder(),
                env: envVars,
                name: TERMINAL_NAME
            });
        }

        terminal.show();

        return terminal;
    }

    static getConsole(): vscode.OutputChannel {
        if (OutputChannel == null) {
            OutputChannel = vscode.window.createOutputChannel("Provenance");
        }
        OutputChannel.show();
        return OutputChannel;
    }

    static getWorkspaceFolder(): string {
        let folder = "";

        if (vscode.workspace.workspaceFolders !== undefined) {
            folder = vscode.workspace.workspaceFolders[0].uri.fsPath; 
        }

        return folder;
    }

    static runCommand(command: string, stdout: (((data:string) => void) | undefined) = undefined, stderr: (((data:string) => void) | undefined) = undefined, cwd: (string | undefined) = undefined): Promise<void> {
        var args = command.split(' ');
        var cmd = args[0];
        args.shift();
    
        const promise = new Promise<void>((resolve, reject) => {
            const proc = child_process.spawn(cmd, args, { cwd: (cwd == undefined ? Utils.getWorkspaceFolder() : cwd) });
    
            var provConsole = Utils.getConsole();
    
            provConsole.appendLine(`> ${command}`);
    
            proc.stdout.on('data', (data: any) => {
                provConsole.appendLine(data);
                if (stdout != undefined) {
                    stdout(data);
                }
            });
            
            proc.stderr.on('data', (data: any) => {
                provConsole.appendLine(data);
                if (stderr != undefined) {
                    stderr(data);
                }
            });
    
            proc.on('error', (err: Error) => {
                provConsole.appendLine(`Failed to start process: ${cmd}`);
                reject(new Error(`Failed to start process: ${cmd}`));
            });
            
            proc.on('close', (code: number) => {
                provConsole.appendLine(`child process exited with code ${code}`);
                if (code == 0) {
                    resolve();
                } else {
                    reject(new Error(`Process exited with code: ${code}`));
                }
            });
        });
    
        return promise;
    }

}

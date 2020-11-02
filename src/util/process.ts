import * as vscode from 'vscode';
import * as cp from 'child_process';
import {ExistingWorkspaceFolderPick} from '../workspace';

export interface Command {
	command: string;
	message: string;
}

export class ProcessRunner {
	private static _outputChannel: vscode.OutputChannel;

	private static get outputChannel() {
		if (!this._outputChannel) {
			this._outputChannel = vscode.window.createOutputChannel("SIMBAChain");
		}

		return this._outputChannel;
	}

	public static async getCWD(choiceMessage: string): Promise<vscode.Uri> {
		var folderPicks: ExistingWorkspaceFolderPick[] = [];

		if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
			for (const wf of vscode.workspace.workspaceFolders) {
				let content = await vscode.workspace.fs.readDirectory(wf.uri);
				folderPicks.push(new ExistingWorkspaceFolderPick(wf, content));
			}
		}

		//If only 1 workspace, use that, otherwise ask the user
		let selectedFolderPick: ExistingWorkspaceFolderPick =
			folderPicks.length === 1 ?
				folderPicks[0] :
				await vscode.window.showQuickPick(folderPicks, {
					canPickMany: false, ignoreFocusOut: true, placeHolder: choiceMessage
				});

		return selectedFolderPick.workspaceFolder.uri;
	}

	public static async runCommand(bin: string, cwd: string, message: string, args: string[] = []): Promise<Command[]> {
		let opts: cp.SpawnOptions = {
			stdio: 'pipe',
			detached: false
		};
		if (cwd) {
			opts['cwd'] = cwd;
		}

		this.outputChannel.clear();
		this.outputChannel.show();

		let process = cp.spawn(bin, args, opts);
		return await this.doRun(process);
	}

	public static async runModule(script: string, cwd: string, message: string, args: string[] = []): Promise<Command[]> {
		let opts: cp.ForkOptions = {
			stdio: 'pipe',
			detached: false
		};
		if (cwd) {
			opts['cwd'] = cwd;
		}

		this.outputChannel.clear();
		this.outputChannel.show();

		let process = cp.fork(script, args, opts);
		return await this.doRun(process);
	}

	private static doRun(process: cp.ChildProcess): Promise<Command[]> {
		let commands: Command[] = [];

		return new Promise((resolve, reject) => {
			process.stdout.on('data', (data: Buffer) => {
				let str = data.toString();
				this.outputChannel.appendLine(str);
			});
			process.stderr.on('data', (data: Buffer) => {
				let str = data.toString();
				this.outputChannel.appendLine("stderr: " + str);
			});

			process.on('message', (message: Command, sendHandle) => {
				console.log(message);
				commands.push(message);
			});

			process.on('error', (error) => {
				reject(error);
			});

			process.on('close', (code, signal) => {
				if (code) {
					reject(code);
				} else {
					resolve(commands);
				}
			});
		});
	}
}

import * as vscode from 'vscode';
import * as which from 'which';

import {Command, ProcessRunner} from '../util/process';

export class Truffle extends ProcessRunner {
	static upload(): Promise<void> {
		return this.truffleCommand("Pick workspace to export.", ["run", "simba", "export"]).then(() => {
		});
	}

	static deploy(app: string): Promise<void> {
		return this.truffleCommand(
			"Pick workspace to export.",
			[
				"run",
				"simba",
				"deploy",
				"--app",
				app,
				"--api",
				"MetaCoinDeploy",
				"--blockchain",
				"ganache",
				"--storage",
				"local",
				"--noinput"
			]).then(() => {
		});
	}

	static export(): Promise<void> {
		return this.truffleCommand("Pick workspace to export.", ["run", "simba", "export"]).then(() => {
		});
	}

	static compile(): Promise<void> {
		return this.truffleCommand("Pick workspace to compile.", ["compile"]).then(() => {
		});
	}

	static build(): Promise<void> {
		return this.truffleCommand("Pick workspace to build.", ["build"]).then(() => {
		});
	}

	public static async truffleCommand(message: string, args: string[] = []): Promise<Command[]> {
		let cwd = await this.getCWD(message);
		let isTruffleProject = await this.verifyTruffleProject(cwd);
		if (!isTruffleProject) {
			throw new Error("This workspace isn't a truffle project! truffle-config.js not found!");
		}

		let trufflePath = await this.trufflePath();
		return await this.runCommand(trufflePath, cwd.fsPath, message, args);
	}

	private static async trufflePath() {
		return which('truffle');
	}

	private static async verifyTruffleProject(workspacePath: vscode.Uri): Promise<boolean> {
		let truffleProjUrl = workspacePath.with({"path": workspacePath.path + "/truffle-config.js"});

		try {
			await vscode.workspace.fs.stat(truffleProjUrl);
			return true;
		} catch (e) {
			// This is not a truffle project
			return false;
		}
	}
}

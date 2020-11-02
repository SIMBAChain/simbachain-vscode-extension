import * as vscode from 'vscode';
import * as path from 'path';

import {ProcessRunner} from '../util/process';

export function getConfig(context: vscode.ExtensionContext): Promise<string> {
	return new Promise(async (resolve, reject) => {
		await vscode.window.withProgress({
			title: "Loading Truffle config",
			location: vscode.ProgressLocation.Notification
		}, async (progress, token) => {
			let cwd = await ProcessRunner.getCWD("Choose the folder with your truffle-config.js inside.");
			const dumpConfig = context.asAbsolutePath(path.join('scripts', 'dumpConfig.js'));
			try {
				let commands = await ProcessRunner.runModule(dumpConfig, cwd.fsPath, "", []);
				let config = commands.filter(cmd => {
					return cmd.command == 'truffleConfig';
				});
				resolve(JSON.parse(config[0].message));
			} catch (e) {
				console.error(e);
			}
		});
	});


}

import * as vscode from 'vscode';
import {Truffle} from '../truffle/cli';

export async function Build(context: vscode.ExtensionContext): Promise<void> {
	await vscode.window.withProgress({
		title: "Building Truffle Project",
		location: vscode.ProgressLocation.Notification
	}, async (progress, token) => {
		return Truffle.build().then(() => {
			vscode.window.showInformationMessage(`Successfully built project.`);
		}).catch((e) => {
			vscode.window.showErrorMessage(`Failed to build project: ${e}`);
		});
	});
}

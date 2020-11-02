import * as vscode from 'vscode';
import {Truffle} from '../truffle/cli';

export async function Upload(context: vscode.ExtensionContext): Promise<void> {
	await vscode.window.withProgress({
		title: "Exporting Truffle Project",
		location: vscode.ProgressLocation.Notification
	}, async (progress, token) => {
		return Truffle.export().then(() => {
			vscode.window.showInformationMessage(`Successfully compiled project.`);
		}).catch((e) => {
			vscode.window.showErrorMessage(`Failed to compile project: ${e}`);
		});
	});
}

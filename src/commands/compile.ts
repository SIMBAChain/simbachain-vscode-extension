import * as vscode from 'vscode';
import {Truffle} from '../truffle/cli';

export async function Compile(): Promise<void> {
	await vscode.window.withProgress({
		title: "Compiling Truffle Project",
		location: vscode.ProgressLocation.Notification
	}, async (progress, token) => {
		return Truffle.compile().then(() => {
			vscode.window.showInformationMessage(`Successfully compiled project.`);
		}).catch((e) => {
			vscode.window.showErrorMessage(`Failed to compile project: ${e}`);
		});
	});
}

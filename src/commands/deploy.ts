import * as vscode from 'vscode';
import {Truffle} from '../truffle/cli';

export async function Deploy(context: vscode.ExtensionContext, app: string): Promise<void> {
	await vscode.window.withProgress({
		title: "Deploying Truffle Project",
		location: vscode.ProgressLocation.Notification
	}, async (progress, token) => {
		return Truffle.deploy(app).then(() => {
			vscode.window.showInformationMessage(`Successfully compiled project.`);
		}).catch((e) => {
			vscode.window.showErrorMessage(`Failed to compile project: ${e}`);
		});
	});
}

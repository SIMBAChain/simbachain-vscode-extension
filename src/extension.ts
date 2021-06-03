'use strict';

import * as vscode from 'vscode';

import {SimbaContractsProvider} from './contracts/simbaContracts';
import {SimbaDeployedProvider} from './deployed/simbaDeployed';
import {TreeItemWithID} from './util';
import {LoginServer} from './authentication';
import {Build, Compile, Upload, WelcomePage} from './commands';

function registerCommandWithContext(command: string, context: vscode.ExtensionContext, callback: (...args: any[]) => any, thisArg?: any): vscode.Disposable {
	return vscode.commands.registerCommand(command, async () => {
		await callback(context);
	});
}

export async function activate(context: vscode.ExtensionContext) {
	/// TODO: Need to be able to set the PySCaaS server endpoint
	const loginServer = new LoginServer(context);
	await loginServer.init();

	const simbaContractsProvider = new SimbaContractsProvider(loginServer);
	const simbaContractsOptions: vscode.TreeViewOptions<TreeItemWithID> = {
		treeDataProvider: simbaContractsProvider,
		showCollapseAll: true,
		canSelectMany: false
	};
	const contractsTreeView = vscode.window.createTreeView("simbaContracts", simbaContractsOptions);
	simbaContractsProvider.treeView = contractsTreeView;

	simbaContractsProvider.registerCommands(context);

	const simbaDeployedProvider = new SimbaDeployedProvider(loginServer);
	const simbaDeployedOptions: vscode.TreeViewOptions<TreeItemWithID> = {
		treeDataProvider: simbaDeployedProvider,
		showCollapseAll: true,
		canSelectMany: false
	};
	const deployedTreeView = vscode.window.createTreeView("simbaDeployed", simbaDeployedOptions);
	simbaDeployedProvider.treeView = deployedTreeView;

	simbaDeployedProvider.registerCommands(context);


	registerCommandWithContext('simbaContracts.build', context, Build);
	registerCommandWithContext('simbaContracts.compile', context, Compile);
	registerCommandWithContext('simbaContracts.upload', context, Upload);

	const welcomePage = new WelcomePage(context, loginServer);

	await welcomePage.checkAndShow();

	const showWelcomePage = vscode.commands.registerCommand('simbaContracts.showWelcomePage', async () => {
		return welcomePage.show();
	});

	const subscriptions: { dispose(): any }[] = [
		showWelcomePage,
		loginServer,
		simbaContractsProvider,
		contractsTreeView,
		simbaDeployedProvider,
		deployedTreeView
	];
	context.subscriptions.push(...subscriptions);

}

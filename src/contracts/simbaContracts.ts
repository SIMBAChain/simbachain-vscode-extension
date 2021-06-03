import * as vscode from 'vscode';
import {Dictionary, firstIndex, FolderOpeningMode, NextPageOrganisation, TreeItemWithID} from '../util';
import {ExistingWorkspaceFolderPick, newFolderPick, newWorkspaceFolderPick, WorkspaceFolderPick} from '../workspace';
import {LoginServer} from '../authentication';
import {Contract} from './treeItems';
import {SimbaProvider} from '../provider';
import {Upload} from '../commands';

export class SimbaContractsProvider extends SimbaProvider {
	private _contracts: Dictionary<Contract[]>;

	constructor(loginServer: LoginServer) {
		super(loginServer, "simbaContracts");
	}

	public registerCommands(context: vscode.ExtensionContext): void {
		vscode.commands.registerCommand('simbaContracts.refreshEntry', () => this.refresh());
		vscode.commands.registerCommand('simbaContracts.login', async () => await this.login());
		vscode.commands.registerCommand('simbaContracts.logout', () => this.logout());
		vscode.commands.registerCommand('simbaContracts.editEntry', (node: Contract) => this.openAndEdit(node));
		vscode.commands.registerCommand('simbaContracts.uploadEntry', (node: Contract) => this.upload(node, context));
		vscode.commands.registerCommand('simbaContracts.next', async (next: NextPageOrganisation) => {
			await vscode.window.withProgress({
				title: "Loading more organisations",
				location: vscode.ProgressLocation.Notification
			}, async (progress, token) => {
				try{
					return await this.loadMoreOrganisations(next);
				}catch(e){
					console.error("Failed to fetch organisations", e);
					throw e;
				}
			});
		});
	}

	public refresh(): void {
		this._contracts = null;
		this._organisations = null;
		if (!this.loginServer.isLoggedIn) {
			this.treeView.message = "Not Logged In!";
		} else {
			this.treeView.message = null;
		}
		this._onDidChangeTreeData.fire(null);
	}

	public async getChildren(element?: TreeItemWithID): Promise<TreeItemWithID[]> {
		return vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Window,
				title: "Fetching Simbachain Data",
				cancellable: false
			},
			(progress, token) => {
				if (!this.loginServer.isLoggedIn) {
					return Promise.resolve(null);
				}
				if (!element) {
					return this.organisations();
				}

				if (element.type === 'Organisation') {
					return this.contractsForOrg(element.id);
				}

				return Promise.resolve(null);
			}
		);
	}

	public async getParent?(element: TreeItemWithID): Promise<TreeItemWithID> {
		return vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Window,
				title: "Fetching Simbachain Data",
				cancellable: false
			},
			(progress, token) => {
				if (element.type === 'Organisation') {
					return void 0;
				}

				let parents = Object.keys(this._contracts).filter(organisationId => {
					return this.contractsForOrg(organisationId).then(contracts => {
						return contracts.filter(contract => contract['id'] === element.id).length;
					});
				});

				return this.organisations().then(organisations => organisations.filter(organisation => organisation.id === parents[0])[0]);
			}
		);
	}

	public async chooseWorkspace(): Promise<vscode.Uri> {
		var selectedFolder: vscode.WorkspaceFolder | undefined;
		var workspaceFolderUri: vscode.Uri | undefined;
		var workspaceFolderIndex: number | undefined;
		var folderOpeningMode: FolderOpeningMode;
		var contractFolderUri: vscode.Uri | undefined;

		var folderPicks: WorkspaceFolderPick[] = [newFolderPick];

		//Build up a list of active workspaces
		if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
			folderPicks.push(newWorkspaceFolderPick);

			for (const wf of vscode.workspace.workspaceFolders) {
				let content = await vscode.workspace.fs.readDirectory(wf.uri);
				folderPicks.push(new ExistingWorkspaceFolderPick(wf, content));
			}
		}

		//If only 1 workspace, use that, otherwise ask the user
		let selectedFolderPick: WorkspaceFolderPick =
			folderPicks.length === 1 ?
				folderPicks[0] :
				await vscode.window.showQuickPick(folderPicks, {
					canPickMany: false, ignoreFocusOut: true, placeHolder: 'Pick workspace folder to create files in.'
				});

		// User didn't pick, so abort
		if (!selectedFolderPick) {
			return null;
		}

		// User selected an existing workspace
		if (selectedFolderPick instanceof ExistingWorkspaceFolderPick) {
			selectedFolder = selectedFolderPick.workspaceFolder;
			workspaceFolderIndex = selectedFolder.index;
			workspaceFolderUri = selectedFolder.uri;
		}

		folderOpeningMode = selectedFolderPick.folderOpeningMode;

		// We don't have a selected folder or workspace URI - assume user wants to choose a folder
		if (!workspaceFolderUri && !selectedFolder) {
			let folderUris = await vscode.window.showOpenDialog({
				canSelectFolders: true,
				canSelectFiles: false,
				canSelectMany: false,
				openLabel: 'Select folder'
			});
			if (!folderUris) {
				return null;
			}

			workspaceFolderUri = folderUris[0];
			// was such workspace folder already open?
			workspaceFolderIndex = vscode.workspace.workspaceFolders && firstIndex(Array.from(vscode.workspace.workspaceFolders), (folder1: any) => folder1.uri.toString() === workspaceFolderUri!.toString());
		}

		// Check if this a truffle project folder
		let truffleProjUrl = workspaceFolderUri.with({"path": workspaceFolderUri.path + "/truffle-config.js"});

		try {
			let truffleProjFileStat = await vscode.workspace.fs.stat(truffleProjUrl);

			// This is a truffle project
			let contractUrl = workspaceFolderUri.with({"path": workspaceFolderUri.path + "/contracts"});
			try {
				let contractUrlStat = await vscode.workspace.fs.stat(contractUrl);
				contractFolderUri = contractUrl;
			} catch (e) {
				await vscode.workspace.fs.createDirectory(contractUrl);
				contractFolderUri = contractUrl;
			}
		} catch (e) {
			// This is not a truffle project
			console.error(e);
			contractFolderUri = workspaceFolderUri;
		}

		// Open the folder/workspace and show it
		if (folderOpeningMode === FolderOpeningMode.AddToWorkspace || folderOpeningMode === undefined) {
			let workSpacesToReplace = typeof workspaceFolderIndex === 'number' && workspaceFolderIndex > -1 ? 1 : 0;
			if (workspaceFolderIndex === undefined || workspaceFolderIndex < 0) {
				workspaceFolderIndex = 0;
			}

			// replace or insert the workspace
			if (workspaceFolderUri) {
				vscode.workspace.updateWorkspaceFolders(workspaceFolderIndex, workSpacesToReplace, {uri: workspaceFolderUri});
			}
		} else if (folderOpeningMode === FolderOpeningMode.OpenFolder) {
			vscode.commands.executeCommand("vscode.openFolder", workspaceFolderUri);
		}

		// Return the folder that the contract should go into
		return contractFolderUri;
	}

	public async getFilePath(path: vscode.Uri): Promise<vscode.Uri> {
		try {
			let stat = await vscode.workspace.fs.stat(path);
			// File exists - Ask user
			let newPath = await vscode.window.showSaveDialog({
				defaultUri: path,
				filters: {"Solidity": ["sol"]},
				saveLabel: 'Contract with this name already exists - Save your contract with a different name'
			});
			return newPath;
		} catch (e) {
			return path;
		}
	}

	public async openAndEdit(contract: Contract) {
		let targetPath = await this.chooseWorkspace();

		let fPath = targetPath.path + '/' + contract.data['name'] + '.sol';
		let path = await this.getFilePath(targetPath.with({path: fPath}));

		let code = contract.data['code'];

		await vscode.workspace.fs.writeFile(path, Buffer.from(code, 'base64'));

		let doc = await vscode.workspace.openTextDocument(path);

		await vscode.window.showTextDocument(doc);
	}

	public async upload(contract: Contract, context: vscode.ExtensionContext) {
		await Upload(context);
	}

	private async contractsForOrg(id: string): Promise<Contract[]> {
		if (!this._contracts) {
			this._contracts = {};

			this._contracts[id] = await this.loginServer.doGetRequest("organisations/" + id + "/contract_designs/").then(resp => {
				return resp.results.map(contract => {
					return new Contract(
						contract['name'],
						contract['id'],
						contract['version'],
						contract['created_on'],
						contract);
				});
			});
		}

		return Promise.resolve(this._contracts[id]);
	}
}

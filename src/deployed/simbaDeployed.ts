import * as vscode from 'vscode';
import {Dictionary, NextPageOrganisation, TreeItemWithID} from '../util';
import {LoginServer} from '../authentication';
import {Application, ContractMethod, DeployedContract, Organisation} from './treeItems';
import {SimbaProvider} from '../provider';
import {Deploy} from '../commands/deploy';

export class SimbaDeployedProvider extends SimbaProvider {
	private _contracts: Dictionary<DeployedContract[]>;
	private _applications: Dictionary<Application[]>;

	constructor(loginServer: LoginServer) {
		super(loginServer, "simbaDeployed");
	}

	public registerCommands(context: vscode.ExtensionContext): void {
		vscode.commands.registerCommand('simbaDeployed.refreshEntry', () => this.refresh());
		vscode.commands.registerCommand('simbaDeployed.login', async () => await this.login());
		vscode.commands.registerCommand('simbaDeployed.logout', () => this.logout());
		vscode.commands.registerCommand('simbaDeployed.viewApp', async (element: Application) => {
			return this.visitApp(element);
		});
		vscode.commands.registerCommand('simbaDeployed.deployApp', async (element: Application) => {
			return this.deploy(element, context);
		});
		vscode.commands.registerCommand('simbaDeployed.viewContract', async (element: DeployedContract) => {
			return this.visitContract(element);
		});

		vscode.commands.registerCommand('simbaDeployed.next', async (next: NextPageOrganisation) => {
			await vscode.window.withProgress({
				title: "Loading more organisations",
				location: vscode.ProgressLocation.Notification
			}, async (progress, token) => {
				return await this.loadMoreOrganisations(next);
			});
		});
	}

	refresh(): void {
		console.log("SimbaDeployedProvider.refresh");
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
		console.log("SimbaDeployedProvider.getChildren");
		return vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Window,
				title: "Fetching Simbachain Data",
				cancellable: false
			},
			async (progress, token) => {
				if (!this.loginServer.isLoggedIn) {
					return Promise.resolve(null);
				}
				if (!element) {
					return await this.organisations();
				}

				if (element.type === 'Organisation') {
					return await this.appsForOrg(element.id);
				}

				if (element.type === 'Application') {
					return await this.deployedForApp(<Application>element);
				}

				if (element.type === 'DeployedContract') {
					let contract = <DeployedContract>element;
					let methods = [];

					Object.keys(contract.methods).forEach(methodName => {
						let method = contract.methods[methodName];
						methods.push(new ContractMethod(methodName, contract.name + '_' + methodName, contract.id, contract.app_id, method.params));
					});

					return Promise.resolve(methods);
				}

				return Promise.resolve(null);
			}
		);
	}

	public async getAppParent(organisationId: string): Promise<Organisation> {
		console.log("SimbaDeployedProvider.getAppParent");
		return this.organisations().then(organisations => organisations.filter(organisation => organisation.id === organisationId)[0]);
	}

	public async getDeployedParent(appId: string): Promise<Application> {
		console.log("SimbaDeployedProvider.getDeployedParent");
		let parents = [];

		for (var organisationId of Object.keys(this._applications)) {
			let apps: Application[] = await this.appsForOrg(organisationId);

			apps.filter(app => {
				return app['id'] === appId;
			}).forEach(app => {
				parents.push(app);
			});
		}


		return parents[0];
	}

	public async getParent?(element: TreeItemWithID): Promise<TreeItemWithID> {
		console.log("SimbaDeployedProvider.getParent");
		return vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Window,
				title: "Fetching Simbachain Data",
				cancellable: false
			},
			async (progress, token) => {
				if (element.type === 'Organisation') {
					return Promise.resolve(null);
				}

				if (element.type === 'Application') {
					return await this.getAppParent((<Application>element).org_id);
				}

				if (element.type === 'DeployedContract') {
					return await this.getDeployedParent((<DeployedContract>element).app_id);
				}

				if (element.type === 'ContractMethod') {
					let contractId = (<ContractMethod>element).contract_id;
					return await this.getDeployedParent(contractId).then(app => {
						return Promise.resolve(this._contracts[app.id].filter(contract => contract.id === contractId)[0]);
					});
				}

				return Promise.resolve(null);
			}
		);
	}

	public async visitApp(element: Application) {
		let scaasUrl = this.loginServer.ScaaSUrl;
		console.log("here");
		return vscode.env.openExternal(vscode.Uri.parse(`${scaasUrl}apps/${element.api_name}/`));
	}

	public async visitContract(element: DeployedContract) {
		let scaasUrl = this.loginServer.ScaaSUrl;
		let app: Application = <Application>(await this.getParent(element));
		return vscode.env.openExternal(vscode.Uri.parse(`${scaasUrl}apps/${app.api_name}/`));
	}

	public async deploy(application: Application, context: vscode.ExtensionContext) {
		await Deploy(context, application.id);
	}

	private async appsForOrg(id: string): Promise<Application[]> {
		console.log("SimbaDeployedProvider.appsForOrg");
		if (!this._applications) {
			this._applications = {};
			this._applications[id] = await this.loginServer.doGetRequest("organisations/" + id + "/applications/").then(resp => {
				return resp.results.map(app => {
					return new Application(
						app['display_name'],
						app['id'],
						app['name'],
						app['created_on'],
						app['metadata'],
						id);
				});
			});
		}

		return Promise.resolve(this._applications[id]);
	}

	private async deployedForApp(element: Application): Promise<DeployedContract[]> {
		console.log("SimbaDeployedProvider.deployedForApp");
		if (!this._contracts) {
			this._contracts = {};
			this._contracts[element.id] = await this.loginServer.doGetRequest("organisations/" + element.org_id + "/deployed_contracts/?filter[applications]=" + element.id).then(resp => {
				return resp.results.map(app => {
					return new DeployedContract(
						app['display_name'] || app['api_name'],
						app['id'],
						app['api_name'],
						app['methods'],
						app['address'],
						app['version'],
						app['lc_api_name'],
						element.id);
				});
			});
		}

		return Promise.resolve(this._contracts[element.id]);
	}
}

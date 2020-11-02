import * as vscode from 'vscode';
import {LoginServer} from './authentication';
import {NextPageOrganisation, Organisation, Refreshable, TreeItemWithID} from './util';

export abstract class SimbaProvider extends vscode.Disposable implements vscode.TreeDataProvider<TreeItemWithID>, Refreshable {
	protected _onDidChangeTreeData: vscode.EventEmitter<TreeItemWithID | undefined> = new vscode.EventEmitter<TreeItemWithID | undefined>();
	public readonly onDidChangeTreeData: vscode.Event<TreeItemWithID | undefined> = this._onDidChangeTreeData.event;
	protected loginServer: LoginServer;
	protected _organisations: Organisation[];
	protected readonly name: string;
	private loadingMore: boolean = false;

	constructor(loginServer: LoginServer, name) {
		super(null);
		this.name = name;
		this.loginServer = loginServer;
		this.loginServer.addRefreshable(this);
	}

	protected _treeView: vscode.TreeView<TreeItemWithID>;

	public get treeView() {
		return this._treeView;
	}

	public set treeView(tv: vscode.TreeView<TreeItemWithID>) {
		this._treeView = tv;
		if (!this.loginServer.isLoggedIn) {
			tv.message = "Not Logged In!";
		}
	}

	public abstract refresh(): void;

	public logout(): void {
		vscode.commands.executeCommand('setContext', 'simbaLoggedIn', false);
		this.loginServer.logout();
	}

	public login(): Thenable<void> {
		return vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Notification,
				title: "Logging in to Simbachain.",
				cancellable: true
			},
			(progress, token) => {
				return this.loginServer.performLogin(progress, token);
			}
		);
	}

	public abstract async getChildren(element?: TreeItemWithID): Promise<TreeItemWithID[]>;

	public getTreeItem(element: TreeItemWithID): TreeItemWithID {
		return element;
	}

	public async getParent?(element: TreeItemWithID): Promise<TreeItemWithID>;

	public abstract registerCommands(context: vscode.ExtensionContext): void;

	protected async organisations(): Promise<Organisation[]> {
		if (!this._organisations) {
			let resp = await this.loginServer.doGetRequest("organisations/");
			this._organisations = resp.results.map(org => {
				return new Organisation(
					org['name'],
					org['id'],
					org['is_user_group'],
					org['created_on'],
					org['metadata'],
					vscode.TreeItemCollapsibleState.Collapsed);
			});

			if (resp.next) {
				this._organisations.push(new NextPageOrganisation(resp.next, `${this.name}.next`, "Next"));
			}
		}

		return Promise.resolve(this._organisations);
	}

	protected async loadMoreOrganisations(next: NextPageOrganisation): Promise<Organisation[]> {
		if (this.loadingMore) return this._organisations;
		this.loadingMore = true;

		this._organisations = this._organisations.filter(org => org.contextValue !== 'next');

		let resp = await this.loginServer.doGetRequest(next);
		this._organisations = this._organisations.concat(resp.results.map(org => {
			return new Organisation(
				org['name'],
				org['id'],
				org['is_user_group'],
				org['created_on'],
				org['metadata'],
				vscode.TreeItemCollapsibleState.Collapsed);
		}));

		if (resp.next) {
			this._organisations.push(new NextPageOrganisation(resp.next, `${this.name}.next`, "Next"));
		}

		this._onDidChangeTreeData.fire(null);

		this.loadingMore = false;
		return this._organisations;
	}
}

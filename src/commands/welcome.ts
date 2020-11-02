import * as vscode from 'vscode';
import * as path from 'path';

export class WelcomePage extends vscode.Disposable {
	protected readonly ShowOnStartupConfig: string = 'WelcomeShowOnStartup';
	protected panel: vscode.WebviewPanel;
	protected readonly context: vscode.ExtensionContext;
	protected hasLoaded: boolean = false;

	constructor(context: vscode.ExtensionContext) {
		super(() => {
			this.panel.dispose();
		});
		this.context = context;
	}

	public async checkAndShow(): Promise<void> {
		const showOnStartup = this.context.globalState.get(this.ShowOnStartupConfig);

		if (showOnStartup === false) {
			return;
		}

		if (showOnStartup === undefined) {
			this.context.globalState.update(this.ShowOnStartupConfig, false);
		}

		await this.show();
	}

	public async show(): Promise<void> {
		if (this.panel) {
			return this.panel.reveal(vscode.ViewColumn.One);
		}

		let options: vscode.WebviewPanelOptions & vscode.WebviewOptions = {
			enableCommandUris: true,
			enableScripts: true,
			localResourceRoots: [vscode.Uri.file(path.join(this.context.extensionPath, 'resources'))],
			retainContextWhenHidden: true,
		};

		this.panel = vscode.window.createWebviewPanel('welcomePage', 'Welcome to SIMBAChain!', vscode.ViewColumn.One, options);


		// await this.panel.webview.postMessage({command: 'setShowOnStartup', checked: this.context.globalState.get(this.ShowOnStartupConfig)});

		this.panel.webview.onDidReceiveMessage((message: { [key: string]: any }) => {
			switch (message.command) {
				case("toggleShowPage") : {
					if (this.hasLoaded) {
						this.context.globalState.update(this.ShowOnStartupConfig, message.value);
					}
					break;
				}
				case("loaded") : {
					this.hasLoaded = true;
					this.panel.webview.postMessage({
						command: 'setShowOnStartup',
						checked: this.context.globalState.get(this.ShowOnStartupConfig)
					});
					break;
				}
				default: {
					vscode.window.showInformationMessage("Command: " + message.command);
				}
			}
		}, undefined, this.context.subscriptions);

		this.panel.webview.html = await this.getHtmlForWebview();
	}

	protected async getHtmlForWebview(): Promise<string> {
		const htmlUrl = vscode.Uri.file(path.join(this.context.extensionPath, 'resources', 'html', 'welcome.html'));
		return await (await vscode.workspace.fs.readFile(htmlUrl)).toString();
	}

}

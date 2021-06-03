import * as vscode from 'vscode';
import * as path from 'path';
import * as cryptoRandomString from 'crypto-random-string';
import * as request from 'request-promise';
import * as http from 'http';
import * as polka from 'polka';
import * as CryptoJS from 'crypto-js';
import {Refreshable} from './util';
import sp from 'synchronized-promise';

import * as Configstore from 'configstore';
import { getSimbaConfig } from './truffle/config';

export const AUTHKEY = 'SIMBAAUTH';


export class LoginServer extends vscode.Disposable {
	private readonly closeTimeout: number = 5 * 1000;
	private port: number = 22315;
	private server: http.Server;
	private state: string;
	private context: vscode.ExtensionContext;
	private refreshables: Refreshable[];
	private redirectUri: string;
	private pkceVerifier: string;
	private pkceChallenge: string;

	constructor(context: vscode.ExtensionContext) {
		super(() => {
			this.server.unref();
			this.server.close();
		});

		this.context = context;

		vscode.commands.executeCommand('setContext', 'simbaLoggedIn', this.isLoggedIn);

		const self = this;

		vscode.window.registerUriHandler({
			handleUri(uri: vscode.Uri): vscode.ProviderResult<void> {
				if (uri.path.startsWith('/did-authenticate')) {
					let params = uri.query.split("&").map(param => param.split("=")).reduce((acc, item) => {
						acc[item[0]] = item[1];
						return acc;
					}, {});

					self.receiveCode(params['code'], params['state'], params['error']);
				}
			}
		});
	}

	get tokenUrl(): string {
		return this.getConfig('tokenUrl');
	}

	get clientID(): string {
		return this.getConfig('clientID');
	}

	get scope(): string {
		return this.getConfig('authScope');
	}

	get baseUrl(): string {
		return this.getConfig('baseUrl');
	}

	get authorizeUrl(): string {
		const url = this.getConfig('authorizeUrl');
		this.generatePKCE();
		const authUrl = `${url}?client_id=${this.clientID}&redirect_uri=${this.redirectUri}&response_type=code&state=${this.state}&scope=${this.scope}&code_challenge=${this.pkceChallenge}&code_challenge_method=S256`;
		console.log(authUrl);
		return authUrl;
	}

	private _configBase!: string;

	get configBase(): string {
		if (!this._configBase) {
			if (!this.configStore) {
				return undefined;
			}
	
			this._configBase = this.configStore.get('baseUrl').split('.').join('_');
		}
		return this._configBase;
	}

	get isLoggedIn(): boolean {
		console.log("LoginServer.isLoggedIn");
		return this.hasConfig(AUTHKEY);
	}

	//TODO: Check token, refresh

	get ScaaSUrl(): string {
		return this.baseUrl;
	}

	private static _configStore: Configstore;

	public async init() {
		if (!LoginServer._configStore) {
			const conf = await getSimbaConfig(this.context);
			LoginServer._configStore = new Configstore('@simbachain/truffle', null, {
				configPath: conf
			});
		}
	}

	private get configStore(): Configstore {
		return LoginServer._configStore;
	}

	public addRefreshable(refreshable: Refreshable) {
		console.log("LoginServer.addRefreshable");
		if (!this.refreshables) {
			this.refreshables = [];
		}
		this.refreshables.push(refreshable);
	}

	hasConfig(key: string): boolean {
		if (!this.configStore){
			return null;
		}
		if (!this.configStore.has(this.configBase)) {
			return this.configStore.has(key);
		}

		return key in this.configStore.get(this.configBase);
	}

	getConfig(key: string): any {
		if (!this.configStore.has(this.configBase)) {
			return this.configStore.get(key);
		}

		let dict = this.configStore.get(this.configBase);


		if (!(key in dict)) {
			return undefined;
		}

		return dict[key];
	}

	setConfig(key: string, value: any): void {
		if (!this.configStore.has(this.configBase)) {
			this.configStore.set(key, value);
			return;
		}

		let dict = this.configStore.get(this.configBase);

		dict[key] = value;

		this.configStore.set(this.configBase, dict);
	}

	deleteConfig(key: string): void {
		if (!this.configStore.has(this.configBase)) {
			this.configStore.delete(key);
			return;
		}

		let dict = this.configStore.get(this.configBase);

		if (!(key in dict)) {
			return;
		}

		delete dict[key];

		this.configStore.set(this.configBase, dict);
	}

	async performLogin(progress: vscode.Progress<any>, token: vscode.CancellationToken): Promise<any> {
		this.state = cryptoRandomString({length: 24, type: 'url-safe'});

		// Ideally, we'd use the registered uri handler for this, but because it's a redirect, it leaves the oauth2 auth page in the browser.
		//return this.performLoginViaRegisteredUriHandler(progress, token);

		return this.performLoginViaIntegratedWebserver(progress, token);
	}

	async performLoginViaRegisteredUriHandler(progress: vscode.Progress<any>, token: vscode.CancellationToken): Promise<any> {
		const callableUri = await vscode.env.asExternalUri(vscode.Uri.parse(`${vscode.env.uriScheme}://SIMBAChain.simbachain-vscode-extension/did-authenticate`));
		this.redirectUri = encodeURIComponent(callableUri.toString(true));
		let url = vscode.Uri.parse(this.authorizeUrl);
		return await vscode.env.openExternal(url);
	}


	public closeServer() {
		setTimeout(() => {
			console.log("LoginServer.closeServer");
			this.refreshables.forEach(r => r.refresh());
			this.server.close();
		}, this.closeTimeout);
	}

	async performLoginViaIntegratedWebserver(progress: vscode.Progress<any>, token: vscode.CancellationToken): Promise<any> {
		return new Promise((resolve, reject) => {
			console.log("LoginServer.performLogin.promise");
			const self = this;
			//clear out old auth
			this.deleteConfig(AUTHKEY);

			if (this.server) {
				reject(new Error("Auth already in progress!"));
			}

			console.log("LoginServer.performLogin.startserver");

			if (token.isCancellationRequested) {
				return reject();
			}

			this.server = http.createServer();

			this.server.on('close', () => {
				this.server = null;
				resolve(void 0);
			});

			polka({server: this.server})
				.get('/auth-callback', (req, res) => {
					let code = req.query.code;
					let state = req.query.state;
					let error = req.query.error;
					res.on('finish', () => {
						self.closeServer();
					});
					this.receiveCode(code, state, error).then(() => {
						res.writeHead(302, {Location: '/'});
						res.end();
					}).catch((err) => {
						res.writeHead(302, {Location: `/?error=${Buffer.from(err).toString('base64')}`});
						res.end();
					});

				})
				.get('/', (req, res) => {
					const htmlUrl = vscode.Uri.file(path.join(this.context.extensionPath, 'resources', 'html', 'authResult.html'));
					vscode.workspace.fs.readFile(htmlUrl).then(file => {
						let body = file.toString();
						res.writeHead(200, {
							'Content-Length': body.length,
							'Content-Type': 'text/html; charset=utf-8',
						});
						res.end(file.toString());
					});
				})
				.listen(this.port, err => {
					if (err) throw err;
					token.onCancellationRequested(() => {
						console.log("Cancellation Requested");
						self.closeServer();
					});
					console.log(`> Running on localhost:${this.port}`);
					this.redirectUri = encodeURIComponent(`http://localhost:${this.port}/auth-callback`);
					vscode.env.openExternal(vscode.Uri.parse(this.authorizeUrl));
				});
		});
	}

	refreshToken(): Promise<boolean> {
		console.log("LoginServer.refreshToken");
		return new Promise((resolve, reject) => {
			let auth: any = this.getConfig(AUTHKEY);
			if (auth) {
				if ('expires_at' in auth) {
					let expires_at = new Date(auth['expires_at']);
					if (expires_at <= new Date()) {
						console.log("LoginServer.Refreshing OAuth2 Token");
						var option = {
							uri: this.tokenUrl,
							method: 'POST',
							json: true,
							form: {
								"client_id": this.clientID,
								"grant_type": "refresh_token",
								"refresh_token": auth['refresh_token']
							}
						};

						request.post(option).then(resp => {
							console.log("LoginServer.refreshToken.gotResp");
							resp = this.parseExpiry(resp);

							this.setConfig(AUTHKEY, resp);
							vscode.commands.executeCommand('setContext', 'simbaLoggedIn', true);

							resolve(true);
						}).catch(err => {
							console.error(err);
							reject(err);
						});
					} else {
						//Refresh not required
						resolve(false);
					}
				} else {
					//Refresh not required
					resolve(false);
				}
			} else {
				reject(new Error("Not authenticated!"));
			}
		});
	}

	parseExpiry(auth: any): any {
		console.log("LoginServer.parseExpiry");
		if ('expires_in' in auth) {
			let retrieved_at = new Date();
			let expires_in = parseInt(auth['expires_in']) * 1000;
			let expires_at = new Date(Date.parse(retrieved_at.toISOString()) + expires_in);

			auth['retrieved_at'] = retrieved_at.toISOString();
			auth['expires_at'] = expires_at.toISOString();
		}
		return auth;
	}

	async receiveCode(code: string, state: string, error: string): Promise<any> {
		console.log("LoginServer.receiveCode", code, state, error);

		if (state !== this.state) {
			vscode.window.showErrorMessage("Error logging in to SIMBAChain: state does not match");
			return Promise.reject("Error logging in to SIMBAChain: state does not match");
		} else if (error) {
			vscode.window.showErrorMessage("Error logging in to SIMBAChain: " + error);
			return Promise.reject("Error logging in to SIMBAChain: " + error);
		} else if (!code) {
			vscode.window.showErrorMessage("Error logging in to SIMBAChain: missing auth code");
			return Promise.reject("Error logging in to SIMBAChain: missing auth code");
		} else {
			var option = {
				uri: this.tokenUrl,
				method: 'POST',
				json: true,
				form: {
					"grant_type": "authorization_code",
					"code": code,
					"redirect_uri": decodeURIComponent(this.redirectUri),
					"code_verifier": this.pkceVerifier,
					"client_id": this.clientID
				}
			};

			return request.post(option).then(async resp => {
				console.log("LoginServer.receiveCode.resp");
				resp = this.parseExpiry(resp);
				this.setConfig(AUTHKEY, resp);
				vscode.commands.executeCommand('setContext', 'simbaLoggedIn', true);

				vscode.window.showInformationMessage("Logged In!");
			}).catch(async error => {
				vscode.window.showErrorMessage("Error logging in to SIMBAChain: " + error);
				return Promise.reject("Error logging in to SIMBAChain: " + error);
			});
		}
	}

	getClientOptions(url): Promise<any> {
		console.log("LoginServer.getClientOptions");
		let auth = this.getConfig(AUTHKEY);

		if (!url.startsWith("http")) {
			url = this.baseUrl + url;
		}

		return this.refreshToken().then(was_refreshed => {
			console.log("LoginServer.getClientOptions.resp => was_refreshed:" + was_refreshed);
			return {
				uri: url,
				headers: {
					'Content-Type': 'application/json',
					'Accept': 'application/json',
					'Authorization': `${auth['token_type']} ${auth['access_token']}`
				},
				json: true
			};
		});
	}

	doGetRequest(url): Promise<any> {
		return this.getClientOptions(url).then(opts => {
			return request.get(opts);
		}).catch(e => {
			console.error(e);
			throw e;
		});
	}

	logout() {
		console.log("LoginServer.logout");
		this.deleteConfig(AUTHKEY);
		this.refreshables.forEach(r => r.refresh());
	}

	protected generatePKCE() {
		this.pkceVerifier = cryptoRandomString({length: 24, type: 'url-safe'});
		let hash = CryptoJS.SHA256(this.pkceVerifier);
		let b64 = this.base64URL(hash.toString(CryptoJS.enc.Base64));
		this.pkceChallenge = b64;
	}

	private base64URL(str: string) {
		return str.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
	}
}

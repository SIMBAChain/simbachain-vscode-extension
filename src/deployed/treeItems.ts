import * as vscode from 'vscode';
import * as path from 'path';

import {NextPageOrganisation, Organisation, TreeItemWithID} from '../util';

export {Organisation, NextPageOrganisation};


export class Application extends TreeItemWithID {
	iconPath = {
		light: path.join(__filename, '..', '..', '..', 'resources', 'light', 'cogs.svg'),
		dark: path.join(__filename, '..', '..', '..', 'resources', 'dark', 'cogs.svg')
	};
	contextValue = 'application';

	constructor(
		public readonly name: string,
		public readonly id: string,
		public readonly api_name: string,
		public readonly created_on: string,
		public readonly metadata: any,
		public readonly org_id: string
	) {
		super(id, "Application", name, vscode.TreeItemCollapsibleState.Collapsed);

		this.label = this.name;
	}

	get tooltip(): string {
		return `${this.name}`;
	}

	get description(): string {
		return "Application";
	}

}


export class DeployedContract extends TreeItemWithID {
	iconPath = {
		light: path.join(__filename, '..', '..', '..', 'resources', 'light', 'cog.svg'),
		dark: path.join(__filename, '..', '..', '..', 'resources', 'dark', 'cog.svg')
	};
	contextValue = 'deployedcontract';

	constructor(
		public readonly name: string,
		public readonly id: string,
		public readonly api_name: string,
		public readonly methods: any,
		public readonly address: string,
		public readonly version: string,
		public readonly lc_api_name: string,
		public readonly app_id: string
	) {
		super(id, "DeployedContract", name, vscode.TreeItemCollapsibleState.Collapsed);

		this.label = this.name;
	}

	get tooltip(): string {
		return `${this.name}`;
	}

	get description(): string {
		return "Deployed Contract";
	}

}

interface Param {
	name: string;
	type: string;
}


export class ContractMethod extends TreeItemWithID {
	iconPath = {
		light: path.join(__filename, '..', '..', '..', 'resources', 'light', 'tools.svg'),
		dark: path.join(__filename, '..', '..', '..', 'resources', 'dark', 'tools.svg')
	};
	contextValue = 'contractMethod';

	constructor(
		public readonly name: string,
		public readonly id: string,
		public readonly contract_id: string,
		public readonly app_id: string,
		public readonly params: Param[]
	) {
		super(id, "ContractMethod", name, vscode.TreeItemCollapsibleState.None);

		this.label = `${this.name}(${this.params.map(p => `${p.type} ${p.name}`).join(', ')})`;
	}

	get tooltip(): string {
		return `${this.name}`;
	}

	get description(): string {
		return "Method";
	}

}


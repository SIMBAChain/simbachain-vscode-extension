import * as vscode from 'vscode';
import * as path from 'path';
import {NextPageOrganisation, Organisation, TreeItemWithID} from '../util';

export {Organisation, NextPageOrganisation};

export class Contract extends TreeItemWithID {
	iconPath = {
		light: path.join(__filename, '..', '..', '..', 'resources', 'light', 'pencil-ruler.svg'),
		dark: path.join(__filename, '..', '..', '..', 'resources', 'dark', 'pencil-ruler.svg')
	};
	contextValue = 'contract';

	constructor(
		public readonly name: string,
		public readonly id: string,
		public readonly version: string,
		public readonly created_on: string,
		// public readonly language: string,
		public readonly data: any
	) {
		super(id, "Contract", name, vscode.TreeItemCollapsibleState.None);

		this.label = this.name;
	}

	get tooltip(): string {
		return `${this.name}`;
	}

	get description(): string {
		return "Contract";
	}

}

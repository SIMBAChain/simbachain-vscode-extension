import * as vscode from 'vscode';
import * as path from 'path';

export function firstIndex<T>(array: T[], fn: (t: T) => boolean): number {
	for (let i = 0; i < array.length; i++) {
		if (fn(array[i])) {
			return i;
		}
	}

	return -1;
}

export const UTF8 = 'utf8';

export interface Refreshable {
	refresh(): void;
}

export interface Dictionary<T> {
	[Key: string]: T;
}

export enum FolderOpeningMode { AddToWorkspace, OpenFolder }


export class TreeItemWithID extends vscode.TreeItem {
	constructor(public readonly id: string, public readonly type, label: string, collapsibleState?: vscode.TreeItemCollapsibleState) {
		super(label, collapsibleState);
	}
}


export class Organisation extends TreeItemWithID {
	iconPath = {
		light: path.join(__filename, '..', '..', '..', 'resources', 'light', 'sitemap.svg'),
		dark: path.join(__filename, '..', '..', '..', 'resources', 'dark', 'sitemap.svg')
	};
	contextValue = 'organisation';

	constructor(
		public readonly name: string,
		public readonly id: string,
		public readonly is_user_group: boolean,
		public readonly created_on: string,
		public readonly metadata: string,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState
	) {
		super(id, "Organisation", name, collapsibleState);

		if (is_user_group) {
			this.name = `Default [${this.name}]`;
		}

		this.label = this.name;
	}

	get tooltip(): string {
		return `${this.name}`;
	}

	get description(): string {
		return "Organisation";
	}

}

export class NextPageOrganisation extends Organisation {
	public url: string;
	public readonly command: vscode.Command = {
		command: 'simbachain.openPackageOnNpm',
		title: '',
		arguments: [this]
	};
	contextValue = 'next';

	constructor(
		url: string,
		commandName: string,
		commandTitle: string
	) {
		super("Load More...", "loadmore", true, "", "", vscode.TreeItemCollapsibleState.None);
		this.command = {
			command: commandName,
			title: commandTitle,
			arguments: [this]
		};

		this.url = url;
		this.label = "Load More...";
	}

	get description(): string {
		return "";
	}
}

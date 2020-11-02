import * as vscode from 'vscode';
import {FolderOpeningMode} from './util';

export abstract class WorkspaceFolderPick implements vscode.QuickPickItem {
	label: string;

	constructor(public folderOpeningMode: FolderOpeningMode) {
	}
}

export class ExistingWorkspaceFolderPick extends WorkspaceFolderPick {

	constructor(public readonly workspaceFolder: vscode.WorkspaceFolder, private content: [string, vscode.FileType][]) {
		super(FolderOpeningMode.AddToWorkspace);
	}

	get label(): string {
		return this.workspaceFolder.name;
	}

	get description(): string {
		return this.workspaceFolder.uri.fsPath;
	}

	// get detail(): string {
	// 	return this.content.length ? `${this.content.length} files/directories may need to be removed..` : null;
	// }
}

export class NewWorkspaceFolderPick extends WorkspaceFolderPick {
	constructor(public label: string, folderOpeningMode: FolderOpeningMode) {
		super(folderOpeningMode);
	}
}

export const newWorkspaceFolderPick = new NewWorkspaceFolderPick("Select/create a local folder to add to this workspace...", FolderOpeningMode.AddToWorkspace);
export const newFolderPick = new NewWorkspaceFolderPick("Select/create a local folder...", FolderOpeningMode.OpenFolder);

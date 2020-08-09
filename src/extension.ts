/// <reference path='./types.d.ts' />

// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";

import * as fixmyjs from "fixmyjs";
import * as jshint from "jshint";
import * as findUp from "find-up";
import * as path from "path";
import * as fs from "fs";

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('Congratulations, your extension "jshint-fix" is now active!');

    const tryFix = () => {
        const editor = vscode.window.activeTextEditor;

        if (!editor) {
            return;
        }

        // load jshint config
        const file = editor.document.uri.fsPath;
        let config;
        try {
            let configFile = findUp.sync("jshint-src.json", { cwd: path.dirname(file) }) || "";
            configFile = fs.readFileSync(configFile, "utf8");
            config = JSON.parse(configFile);
        } catch (error) {
            vscode.window.showWarningMessage("jshint-src.json not found", {});
            config = {};
        }

        const selectedText = editor.document.getText(editor.selection);
        const text = selectedText || editor.document.getText();
        let retText = "";

        // call fixmyjs to get the fixes
        try {
            const legacyMode = vscode.workspace.getConfiguration().get("fixjs.legacy");
            if (legacyMode) {
                jshint.JSHINT(text, config);
                retText = fixmyjs(jshint.JSHINT.data(), text).run();
            } else {
                retText = fixmyjs.fix(text, config);
            }
        } catch (err) {
            console.error(err);
            vscode.window.showErrorMessage(`[fixjs] autofix failed with error: ${err}`);
            return;
        }

        const cursorPosition: vscode.Position = editor.selection.active;
        const line = editor.document.lineAt(cursorPosition).lineNumber;

        // apply the fixes
        if (selectedText) {
            editor.edit((editBuilder: vscode.TextEditorEdit) => {
                editBuilder.replace(editor.selection, retText);
            });
        } else {
            const fullText = editor.document.getText();
            const fullRange: vscode.Range = new vscode.Range(
                editor.document.positionAt(0),
                editor.document.positionAt(fullText.length)
            );
            editor.edit((editBuilder: vscode.TextEditorEdit) => {
                editBuilder.replace(fullRange, retText);
            });
        }

        const newPosition: vscode.Position = cursorPosition.with(line, 0);
        const newSelection = new vscode.Selection(newPosition, newPosition);
        editor.selection = newSelection;

        // Display a message box to the user
        vscode.window.showInformationMessage("[fixjs] done!");
    };

    vscode.workspace.onDidSaveTextDocument((e: vscode.TextDocument) => {
        const formatOnSave = vscode.workspace.getConfiguration().get("fixjs.formatOnSave");
        if (formatOnSave) { tryFix(); }
    });

    // The command has been defined in the package.json file
    // Now provide the implementation of the command with registerCommand
    // The commandId parameter must match the command field in package.json
    let disposable = vscode.commands.registerCommand("fixjs.fix", tryFix);

    context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {}

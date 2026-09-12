import * as fs from "node:fs";

import * as vscode from "vscode";
import type MarkdownIt = require("markdown-it");

import { configureHook, type ConfigurationLike, type VscodeLike } from "./hooks/configure";
import { extendMarkdownIt, type PreviewSettings } from "./preview";
import { BUILTIN_THEMES } from "./theme-list";
import { resolveThemesFolder, ThemeStore } from "./theme-store";

const THEME_SETTING = "markdownPreviewThemes.theme";
const THEME_HOOKS_SETTING = "markdownPreviewThemes.themeHooks";
const DEFAULT_HOOK_SETTING = "markdownPreviewThemes.defaultHook";
const FOLDER_SETTING = "markdownPreviewThemes.themesFolder";
const SELECT_THEME_COMMAND = "markdownPreviewThemes.selectTheme";
const CHANGE_FOLDER_COMMAND = "markdownPreviewThemes.changeThemesFolder";
const CONFIGURE_HOOK_COMMAND = "markdownPreviewThemes.configureHook";

export function activate(context: vscode.ExtensionContext): {
    extendMarkdownIt(markdownIt: MarkdownIt.MarkdownIt): MarkdownIt.MarkdownIt;
} {
    const themeStore = new ThemeStore({
        getFolderPath: () =>
            vscode.workspace.getConfiguration("markdownPreviewThemes").get<unknown>("themesFolder", ""),
        getWorkspaceFolder: () => vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
        onChange: refreshPreview,
    });

    themeStore.watch();
    context.subscriptions.push(themeStore);
    context.subscriptions.push(vscode.commands.registerCommand(SELECT_THEME_COMMAND, selectTheme));
    context.subscriptions.push(vscode.commands.registerCommand(CHANGE_FOLDER_COMMAND, changeThemesFolder));
    context.subscriptions.push(vscode.commands.registerCommand(CONFIGURE_HOOK_COMMAND, configureCurrentHook));
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((event) => {
            if (event.affectsConfiguration(FOLDER_SETTING)) {
                themeStore.watch();
                refreshPreview();
            } else if (
                event.affectsConfiguration(THEME_SETTING) ||
                event.affectsConfiguration(THEME_HOOKS_SETTING) ||
                event.affectsConfiguration(DEFAULT_HOOK_SETTING)
            ) {
                refreshPreview();
            }
        }),
    );

    function getConfiguration(): vscode.WorkspaceConfiguration {
        return vscode.workspace.getConfiguration("markdownPreviewThemes");
    }

    function getCurrentTheme(configuration: vscode.WorkspaceConfiguration): string {
        const configuredTheme = configuration.get<unknown>("theme", "vscode");
        return typeof configuredTheme === "string" &&
            (BUILTIN_THEMES.has(configuredTheme) || themeStore.has(configuredTheme))
            ? configuredTheme
            : "vscode";
    }

    function getConfigurationTarget(
        configuration: vscode.WorkspaceConfiguration,
        setting: string,
    ): vscode.ConfigurationTarget {
        const inspected = configuration.inspect(setting);
        return inspected?.workspaceFolderValue !== undefined
            ? vscode.ConfigurationTarget.WorkspaceFolder
            : inspected?.workspaceValue !== undefined
              ? vscode.ConfigurationTarget.Workspace
              : vscode.ConfigurationTarget.Global;
    }

    async function selectTheme(): Promise<void> {
        themeStore.refresh();
        const configuration = getConfiguration();
        const currentTheme = getCurrentTheme(configuration);
        const customThemes = themeStore.names();
        const items = [...new Set([...BUILTIN_THEMES, ...customThemes])]
            .sort((a, b) => a.localeCompare(b))
            .map((label) => ({
                label,
                iconPath: new vscode.ThemeIcon(label === currentTheme ? "circle-filled" : "circle-outline"),
                description: customThemes.has(label)
                    ? BUILTIN_THEMES.has(label)
                        ? "Custom (overrides built-in)"
                        : "Custom"
                    : "Built-in",
            }));
        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: `Select a Markdown preview theme (current: ${currentTheme})`,
        });
        if (!selected) return;

        try {
            if (customThemes.has(selected.label) && themeStore.getCss(selected.label) === null) {
                throw new Error(`Could not read ${selected.label}.css`);
            }

            await configuration.update("theme", selected.label, getConfigurationTarget(configuration, "theme"));
            void vscode.window.showInformationMessage(`Markdown preview theme selected: ${selected.label}`);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            void vscode.window.showErrorMessage(`Failed to select theme "${selected.label}": ${message}`);
        }
    }

    async function configureCurrentHook(): Promise<void> {
        themeStore.refresh();
        const configuration = getConfiguration();
        await configureHook(
            vscode as unknown as VscodeLike,
            getCurrentTheme(configuration),
            configuration as unknown as ConfigurationLike,
            (value, setting) => getConfigurationTarget(value as vscode.WorkspaceConfiguration, setting),
        );
    }

    async function changeThemesFolder(): Promise<void> {
        const configuration = getConfiguration();
        const currentFolder = resolveThemesFolder(
            configuration.get<string>("themesFolder", ""),
            vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
        );
        const selected = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            defaultUri: currentFolder && fs.existsSync(currentFolder) ? vscode.Uri.file(currentFolder) : undefined,
            openLabel: "Use Themes Folder",
            title: "Select Custom Themes Folder",
        });
        if (!selected?.[0]) return;

        await configuration.update(
            "themesFolder",
            selected[0].fsPath,
            getConfigurationTarget(configuration, "themesFolder"),
        );
    }

    function previewSettings(): PreviewSettings {
        const configuration = getConfiguration();
        return {
            theme: configuration.get<unknown>("theme", "vscode"),
            themeHooks: configuration.get<unknown>("themeHooks", {}),
            defaultHook: configuration.get<unknown>("defaultHook", "auto"),
        };
    }

    function refreshPreview(): void {
        void vscode.commands.executeCommand("markdown.preview.refresh");
    }

    return {
        extendMarkdownIt(markdownIt: MarkdownIt.MarkdownIt): MarkdownIt.MarkdownIt {
            return extendMarkdownIt(markdownIt, { getSettings: previewSettings, themeStore });
        },
    };
}

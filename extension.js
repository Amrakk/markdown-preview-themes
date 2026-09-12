"use strict";

const vscode = require("vscode");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { installThemeHooks, renderWithThemeHooks } = require("./hooks");
const manifest = require("./package.json");

const THEME_SETTING = "markdownPreviewThemes.theme";
const FOLDER_SETTING = "markdownPreviewThemes.themesFolder";
const SELECT_THEME_COMMAND = "markdownPreviewThemes.selectTheme";
const CHANGE_FOLDER_COMMAND = "markdownPreviewThemes.changeThemesFolder";
const BUILTIN_THEMES = new Set([
    "vscode",
    ...manifest.contributes["markdown.previewStyles"].map((file) => path.basename(file, path.extname(file))),
]);

let customThemes = new Set();
let watcher = null;

/**
 * Scans a directory for CSS files and returns theme names
 */
function resolveThemesFolder(folderPath) {
    if (!folderPath) return null;

    const expandedPath = folderPath.replace(/^~(?=$|[\\/])/, os.homedir());
    return path.resolve(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || "", expandedPath);
}

function scanThemesFolder(folderPath) {
    const themes = new Set();
    const absolutePath = resolveThemesFolder(folderPath);
    if (!absolutePath) return themes;

    try {
        const files = fs.readdirSync(absolutePath, { withFileTypes: true });
        for (const file of files) {
            if (file.isFile() && path.extname(file.name) === ".css") {
                const themeName = path.basename(file.name, ".css");
                if (themeName) themes.add(themeName);
            }
        }
    } catch (err) {
        console.error("Error scanning themes folder:", err.message);
    }

    return themes;
}

/**
 * Refreshes the available custom themes
 */
function updateThemes() {
    const folderPath = vscode.workspace.getConfiguration("markdownPreviewThemes").get("themesFolder", "");
    customThemes = scanThemesFolder(folderPath);

    // Notify the user about loaded custom themes
    if (customThemes.size > 0) {
        console.log("Loaded custom themes:", Array.from(customThemes).join(", "));
    }
}

function watchThemesFolder() {
    watcher?.close();
    watcher = null;
    updateThemes();

    const folderPath = vscode.workspace.getConfiguration("markdownPreviewThemes").get("themesFolder", "");
    const absolutePath = resolveThemesFolder(folderPath);
    if (!absolutePath) return;

    try {
        watcher = fs.watch(absolutePath, () => {
            updateThemes();
            void vscode.commands.executeCommand("markdown.preview.refresh");
        });
    } catch (err) {
        console.error("Error watching themes folder:", err.message);
    }
}

async function selectTheme() {
    updateThemes();

    const configuration = vscode.workspace.getConfiguration("markdownPreviewThemes");
    const configuredTheme = configuration.get("theme", "vscode");
    const currentTheme =
        BUILTIN_THEMES.has(configuredTheme) || customThemes.has(configuredTheme) ? configuredTheme : "vscode";
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
        if (customThemes.has(selected.label) && getCustomThemeCss(selected.label) === null) {
            throw new Error(`Could not read ${selected.label}.css`);
        }

        await configuration.update("theme", selected.label, getConfigurationTarget(configuration, "theme"));
        void vscode.window.showInformationMessage(`Markdown preview theme selected: ${selected.label}`);
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        void vscode.window.showErrorMessage(`Failed to select theme "${selected.label}": ${message}`);
    }
}

function getConfigurationTarget(configuration, setting) {
    const inspected = configuration.inspect(setting);
    return inspected?.workspaceFolderValue !== undefined
        ? vscode.ConfigurationTarget.WorkspaceFolder
        : inspected?.workspaceValue !== undefined
          ? vscode.ConfigurationTarget.Workspace
          : vscode.ConfigurationTarget.Global;
}

async function changeThemesFolder() {
    const configuration = vscode.workspace.getConfiguration("markdownPreviewThemes");
    const currentFolder = resolveThemesFolder(configuration.get("themesFolder", ""));
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

/**
 * Gets the CSS file path for a custom theme
 */
function getCustomThemePath(themeName) {
    const folderPath = vscode.workspace.getConfiguration("markdownPreviewThemes").get("themesFolder", "");

    if (!folderPath || !customThemes.has(themeName)) {
        return null;
    }

    try {
        const absolutePath = resolveThemesFolder(folderPath);
        const cssPath = path.join(absolutePath, themeName + ".css");
        return cssPath;
    } catch (err) {
        return null;
    }
}

/**
 * Gets the CSS content for a custom theme
 */
function getCustomThemeCss(themeName) {
    const cssPath = getCustomThemePath(themeName);
    if (!cssPath || !fs.existsSync(cssPath)) {
        return null;
    }

    try {
        return fs.readFileSync(cssPath, "utf-8");
    } catch (err) {
        console.error(`Error reading theme file ${cssPath}:`, err.message);
        return null;
    }
}

function activate(context) {
    watchThemesFolder();
    context.subscriptions.push({ dispose: () => watcher?.close() });
    context.subscriptions.push(vscode.commands.registerCommand(SELECT_THEME_COMMAND, selectTheme));
    context.subscriptions.push(vscode.commands.registerCommand(CHANGE_FOLDER_COMMAND, changeThemesFolder));

    // Watch for configuration changes
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((event) => {
            if (event.affectsConfiguration(FOLDER_SETTING)) {
                watchThemesFolder();
                void vscode.commands.executeCommand("markdown.preview.refresh");
            } else if (event.affectsConfiguration(THEME_SETTING)) {
                void vscode.commands.executeCommand("markdown.preview.refresh");
            }
        }),
    );

    return {
        extendMarkdownIt(markdownIt) {
            installThemeHooks(markdownIt);
            const render = markdownIt.renderer.render.bind(markdownIt.renderer);
            markdownIt.renderer.render = (tokens, options, env) => {
                const configured = vscode.workspace.getConfiguration("markdownPreviewThemes").get("theme", "vscode");

                // Validate theme exists (builtin or custom)
                const isValidTheme = BUILTIN_THEMES.has(configured) || customThemes.has(configured);
                const theme = isValidTheme ? configured : "vscode";

                // Inject custom theme CSS if needed
                let styleTag = "";
                let markerTheme = theme;
                if (customThemes.has(theme)) {
                    const themeCss = getCustomThemeCss(theme);
                    if (themeCss) {
                        styleTag = `<style id="markdown-preview-themes-custom">${themeCss}</style>\n`;
                        // ponytail: one declared theme per file; use a CSS parser if multi-theme files are needed.
                        markerTheme =
                            themeCss.match(/#markdown-preview-themes\[data-theme\s*=\s*(["'])(.*?)\1\]/)?.[2] || theme;
                    }
                }

                return (
                    styleTag +
                    '<span id="markdown-preview-themes" data-theme="' +
                    markerTheme.replaceAll("&", "&amp;").replaceAll('"', "&quot;") +
                    '" hidden></span>\n' +
                    renderWithThemeHooks(theme, markdownIt, render, tokens, options, env)
                );
            };
            return markdownIt;
        },
    };
}

module.exports = { activate };

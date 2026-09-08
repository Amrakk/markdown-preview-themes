"use strict";

const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
const manifest = require("./package.json");

const THEME_SETTING = "markdownPreviewThemes.theme";
const FOLDER_SETTING = "markdownPreviewThemes.themesFolder";
const BUILTIN_THEMES = new Set(manifest.contributes.configuration.properties[THEME_SETTING].enum);

let customThemes = new Set();
let watcher = null;

/**
 * Scans a directory for CSS files and returns theme names
 */
async function scanThemesFolder(folderPath) {
    const themes = new Set();

    if (!folderPath) return themes;

    try {
        const expandedPath = folderPath.replace(/^~/, require("os").homedir());
        const absolutePath = path.resolve(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || "", expandedPath);

        if (!fs.existsSync(absolutePath)) {
            return themes;
        }

        const files = fs.readdirSync(absolutePath);
        for (const file of files) {
            if (file.endsWith(".css")) {
                const themeName = file.slice(0, -4); // Remove .css extension
                themes.add(themeName);
            }
        }
    } catch (err) {
        console.error("Error scanning themes folder:", err.message);
    }

    return themes;
}

/**
 * Updates the configuration schema with available themes
 */
async function updateThemeEnum() {
    const folderPath = vscode.workspace.getConfiguration("markdownPreviewThemes").get("themesFolder", "");

    const themes = await scanThemesFolder(folderPath);
    customThemes = themes;

    // Notify the user about loaded custom themes
    if (customThemes.size > 0) {
        console.log("Loaded custom themes:", Array.from(customThemes).join(", "));
    }
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
        const expandedPath = folderPath.replace(/^~/, require("os").homedir());
        const absolutePath = path.resolve(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || "", expandedPath);
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
    // Initial scan of custom themes
    updateThemeEnum();

    // Watch for configuration changes
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(async (event) => {
            if (event.affectsConfiguration(FOLDER_SETTING)) {
                await updateThemeEnum();
                void vscode.commands.executeCommand("markdown.preview.refresh");
            } else if (event.affectsConfiguration(THEME_SETTING)) {
                void vscode.commands.executeCommand("markdown.preview.refresh");
            }
        }),
    );

    // Watch themes folder for changes
    const folderPath = vscode.workspace.getConfiguration("markdownPreviewThemes").get("themesFolder", "");

    if (folderPath) {
        try {
            const expandedPath = folderPath.replace(/^~/, require("os").homedir());
            const absolutePath = path.resolve(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || "", expandedPath);
            if (fs.existsSync(absolutePath)) {
                watcher = fs.watch(absolutePath, async () => {
                    await updateThemeEnum();
                    void vscode.commands.executeCommand("markdown.preview.refresh");
                });
                context.subscriptions.push({ dispose: () => watcher?.close() });
            }
        } catch (err) {
            console.error("Error setting up themes folder watcher:", err.message);
        }
    }

    return {
        extendMarkdownIt(markdownIt) {
            const render = markdownIt.renderer.render.bind(markdownIt.renderer);
            markdownIt.renderer.render = (tokens, options, env) => {
                const configured = vscode.workspace
                    .getConfiguration("markdownPreviewThemes")
                    .get("theme", "vscode");

                // Validate theme exists (builtin or custom)
                const isValidTheme = BUILTIN_THEMES.has(configured) || customThemes.has(configured);
                const theme = isValidTheme ? configured : "vscode";

                // Inject custom theme CSS if needed
                let styleTag = "";
                if (customThemes.has(theme)) {
                    const themeCss = getCustomThemeCss(theme);
                    if (themeCss) {
                        styleTag = `<style id="markdown-preview-themes-custom">${themeCss}</style>\n`;
                    }
                }

                return (
                    styleTag +
                    '<span id="markdown-preview-themes" data-theme="' +
                    theme +
                    '" hidden></span>\n' +
                    render(tokens, options, env)
                );
            };
            return markdownIt;
        },
    };
}

module.exports = { activate };

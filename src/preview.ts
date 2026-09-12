import type MarkdownIt = require("markdown-it");

import { installThemeHooks, renderWithThemeHooks, resolveHook, type MarkdownRender } from "./hooks";
import { BUILTIN_THEMES } from "./theme-list";

type MarkdownItInstance = MarkdownIt.MarkdownIt;

export interface PreviewSettings {
    readonly theme: unknown;
    readonly themeHooks: unknown;
    readonly defaultHook: unknown;
}

export interface ThemeStoreLike {
    has(themeName: string): boolean;
    getCss(themeName: string): string | null;
}

export interface PreviewOptions {
    readonly getSettings: () => PreviewSettings;
    readonly themeStore: ThemeStoreLike;
}

export function escapeAttribute(value: string): string {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll('"', "&quot;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
}

/** Prevent CSS text from ending the injected style element early. */
export function neutralizeStyleTag(css: string): string {
    return css.replace(/<\/style/gi, "<\\u002fstyle");
}

export function extendMarkdownIt(markdownIt: MarkdownItInstance, options: PreviewOptions): MarkdownItInstance {
    installThemeHooks(markdownIt);
    const originalRender = markdownIt.renderer.render.bind(markdownIt.renderer);
    const render: MarkdownRender = (tokens, renderOptions, env) =>
        originalRender(
            tokens,
            (renderOptions || markdownIt.options) as Required<MarkdownIt.MarkdownItOptions>,
            env as MarkdownIt.Env | undefined,
        );

    markdownIt.renderer.render = (tokens, renderOptions, env) => {
        const settings = options.getSettings();
        const configuredTheme = typeof settings.theme === "string" ? settings.theme : "vscode";
        const theme =
            BUILTIN_THEMES.has(configuredTheme) || options.themeStore.has(configuredTheme)
                ? configuredTheme
                : "vscode";
        const css = options.themeStore.getCss(theme);
        const styleTag = css === null ? "" : `<style id="markdown-preview-themes-custom">${neutralizeStyleTag(css)}</style>\n`;
        const hookId = resolveHook(theme, settings.themeHooks, settings.defaultHook)?.id ?? null;
        const markerHook = hookId ? ` data-hook="${escapeAttribute(hookId)}"` : "";
        const marker =
            `<span id="markdown-preview-themes" data-theme="${escapeAttribute(theme)}"${markerHook} hidden></span>\n`;

        return (
            marker +
            renderWithThemeHooks(
                theme,
                markdownIt,
                render,
                tokens,
                renderOptions,
                env,
                settings.themeHooks,
                settings.defaultHook,
            ) +
            styleTag
        );
    };

    return markdownIt;
}

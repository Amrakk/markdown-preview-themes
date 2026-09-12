import type MarkdownIt = require("markdown-it");

import github from "./github";

type MarkdownItInstance = MarkdownIt.MarkdownIt;

export type HookId = "github";
export type HookChoice = "auto" | "none" | HookId;
export type ThemeHookOverrides = Record<string, "none" | HookId>;

export interface HookStrategy {
    readonly id: HookId;
    readonly label: string;
    install(markdownIt: MarkdownItInstance): void;
    transform(markdownIt: MarkdownItInstance, tokens: MarkdownIt.Token[], env: unknown): MarkdownIt.Token[];
}

export interface HookMetadata {
    readonly id: HookId;
    readonly label: string;
}

export type MarkdownRender = (
    tokens: MarkdownIt.Token[],
    options: MarkdownIt.MarkdownItOptions | undefined,
    env: unknown,
) => string;

const bundledHooks: readonly HookStrategy[] = [github];
const strategies = new Map<HookId, HookStrategy>();

for (const strategy of bundledHooks) {
    if (
        !strategy ||
        typeof strategy.id !== "string" ||
        !strategy.id ||
        typeof strategy.label !== "string" ||
        !strategy.label ||
        typeof strategy.install !== "function" ||
        typeof strategy.transform !== "function"
    ) {
        throw new TypeError("Invalid Markdown preview hook strategy");
    }

    if (strategies.has(strategy.id)) {
        throw new Error(`Duplicate Markdown preview hook id: ${strategy.id}`);
    }
    strategies.set(strategy.id, strategy);
}

/** Hook metadata safe for the settings UI; user JavaScript is never loaded. */
export const HOOKS: readonly HookMetadata[] = Object.freeze(
    bundledHooks.map(({ id, label }) => Object.freeze({ id, label })),
);
const installedMarkdownIts = new WeakSet<MarkdownItInstance>();

/**
 * Resolve a hook using the theme override, then the configured default.
 * An explicit invalid value is an explicit no-hook choice.
 */
export function resolveHook(
    theme: string,
    themeHooks: unknown = {},
    defaultHook: unknown = "auto",
): HookStrategy | null {
    const validThemeHooks = themeHooks !== null && typeof themeHooks === "object" && !Array.isArray(themeHooks);
    if (validThemeHooks && Object.prototype.hasOwnProperty.call(themeHooks, theme)) {
        const configuredHookId = (themeHooks as Record<string, unknown>)[theme];
        return configuredHookId === "none" ? null : strategies.get(configuredHookId as HookId) || null;
    }

    if (defaultHook === "none") return null;
    if (typeof defaultHook === "string" && strategies.has(defaultHook as HookId)) {
        return strategies.get(defaultHook as HookId) || null;
    }
    return defaultHook === "auto" ? strategies.get(theme as HookId) || null : null;
}

/** Install each bundled hook once per Markdown-It instance. */
export function installThemeHooks(markdownIt: MarkdownItInstance): void {
    if (installedMarkdownIts.has(markdownIt)) return;

    for (const strategy of strategies.values()) strategy.install(markdownIt);
    installedMarkdownIts.add(markdownIt);
}

/** Resolve and render with the selected theme; an absent hook follows ordinary Markdown. */
export function renderWithThemeHooks(
    theme: string,
    markdownIt: MarkdownItInstance,
    render: MarkdownRender,
    tokens: MarkdownIt.Token[],
    options: MarkdownIt.MarkdownItOptions | undefined,
    env: unknown,
    themeHooks: unknown,
    defaultHook: unknown = "auto",
): string {
    const strategy = resolveHook(theme, themeHooks, defaultHook);
    const transformed = strategy ? strategy.transform(markdownIt, tokens, env) : tokens;
    return render(transformed || tokens, options, env);
}

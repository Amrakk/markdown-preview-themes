"use strict";

const github = require("./github");

/**
 * Bundled hook contract:
 *
 * {
 *     id: string,
 *     label: string,
 *     install(markdownIt): void,
 *     transform(markdownIt, tokens, env): Token[]
 * }
 */
const bundledHooks = [github];
const strategies = new Map();

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
const HOOKS = Object.freeze(bundledHooks.map(({ id, label }) => Object.freeze({ id, label })));
const installedMarkdownIts = new WeakSet();

/**
 * Resolve a hook using the theme override, then the configured default.
 * An explicit invalid value is an explicit no-hook choice.
 */
function resolveHook(theme, themeHooks = {}, defaultHook = "auto") {
    const validThemeHooks = themeHooks && typeof themeHooks === "object" && !Array.isArray(themeHooks);
    if (validThemeHooks && Object.prototype.hasOwnProperty.call(themeHooks, theme)) {
        const configuredHookId = themeHooks[theme];
        return configuredHookId === "none" ? null : strategies.get(configuredHookId) || null;
    }

    if (defaultHook === "none") return null;
    if (typeof defaultHook === "string" && strategies.has(defaultHook)) return strategies.get(defaultHook);
    return defaultHook === "auto" && typeof theme === "string" ? strategies.get(theme) || null : null;
}

/** Install each bundled hook once per Markdown-It instance. */
function installThemeHooks(markdownIt) {
    if (installedMarkdownIts.has(markdownIt)) return;

    for (const strategy of strategies.values()) strategy.install(markdownIt);
    installedMarkdownIts.add(markdownIt);
}

/** Resolve and render with the selected theme; an absent hook follows ordinary Markdown. */
function renderWithThemeHooks(theme, markdownIt, render, tokens, options, env, themeHooks, defaultHook = "auto") {
    const strategy = resolveHook(theme, themeHooks, defaultHook);
    const transformed = strategy ? strategy.transform(markdownIt, tokens, env) : tokens;
    return render(transformed ?? tokens, options, env);
}

module.exports = {
    HOOKS,
    installThemeHooks,
    renderWithThemeHooks,
    resolveHook,
};

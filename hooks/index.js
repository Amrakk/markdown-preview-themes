"use strict";

const github = require("./github");

const strategies = { github };

function installThemeHooks(markdownIt) {
    for (const strategy of Object.values(strategies)) strategy.install(markdownIt);
}

function renderWithThemeHooks(theme, markdownIt, render, tokens, options, env) {
    return render(strategies[theme]?.transform(markdownIt, tokens, env) || tokens, options, env);
}

module.exports = { installThemeHooks, renderWithThemeHooks };

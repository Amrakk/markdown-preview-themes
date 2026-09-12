import { HOOKS, resolveHook, type HookId } from "./index";

export interface ConfigurationTargetValues {
    readonly Global: ConfigurationTarget;
    readonly Workspace: ConfigurationTarget;
    readonly WorkspaceFolder: ConfigurationTarget;
}

export type ConfigurationTarget = number;

export interface ConfigurationLike {
    get<T>(setting: string, fallback: T): T;
    inspect(setting: string): ConfigurationInspection | undefined;
    update(setting: string, value: unknown, target: ConfigurationTarget): PromiseLike<void>;
}

interface ConfigurationInspection {
    readonly globalValue?: unknown;
    readonly workspaceValue?: unknown;
    readonly workspaceFolderValue?: unknown;
}

interface QuickPickChoice {
    readonly label: string;
    readonly description: string;
    readonly hookId: "auto" | "none" | HookId;
}

interface ScopeChoice {
    readonly label: string;
    readonly description?: string;
    readonly scope: "theme" | "default" | "cancel";
}

export interface VscodeLike {
    readonly ConfigurationTarget: ConfigurationTargetValues;
    readonly window: {
        showQuickPick<T>(items: readonly T[], options: { placeHolder: string }): PromiseLike<T | undefined>;
        showInformationMessage(message: string): unknown;
        showErrorMessage(message: string): unknown;
    };
    readonly commands: {
        executeCommand(command: string): unknown;
    };
}

function getConfigurationValueAtTarget(
    configuration: ConfigurationLike,
    setting: string,
    target: ConfigurationTarget,
    vscode: VscodeLike,
): unknown {
    const inspected = configuration.inspect(setting);
    if (!inspected) return undefined;
    if (target === vscode.ConfigurationTarget.WorkspaceFolder) return inspected.workspaceFolderValue;
    if (target === vscode.ConfigurationTarget.Workspace) return inspected.workspaceValue;
    return inspected.globalValue;
}

function isSettingsObject(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

function getThemeHooksForTarget(
    configuration: ConfigurationLike,
    target: ConfigurationTarget,
    vscode: VscodeLike,
): Record<string, unknown> {
    const value = getConfigurationValueAtTarget(configuration, "themeHooks", target, vscode);
    return isSettingsObject(value) ? { ...value } : {};
}

function getThemeHookOverrideTarget(
    configuration: ConfigurationLike,
    theme: string,
    getConfigurationTarget: (configuration: ConfigurationLike, setting: string) => ConfigurationTarget,
    vscode: VscodeLike,
): ConfigurationTarget {
    const inspected = configuration.inspect("themeHooks");
    const scopes: [ConfigurationTarget, unknown][] = [
        [vscode.ConfigurationTarget.WorkspaceFolder, inspected?.workspaceFolderValue],
        [vscode.ConfigurationTarget.Workspace, inspected?.workspaceValue],
        [vscode.ConfigurationTarget.Global, inspected?.globalValue],
    ];
    for (const [target, value] of scopes) {
        if (isSettingsObject(value) && Object.prototype.hasOwnProperty.call(value, theme)) return target;
    }
    return getConfigurationTarget(configuration, "themeHooks");
}

function describeHookResolution(theme: string, themeHooks: unknown, defaultHook: unknown): string {
    const hook = resolveHook(theme, themeHooks, defaultHook);
    const hasOverride =
        isSettingsObject(themeHooks) && Object.prototype.hasOwnProperty.call(themeHooks, theme);
    if (hasOverride) return hook ? `${hook.label} (theme override)` : "no hook (theme override)";
    if (defaultHook === "none") return "no hook (default)";
    if (defaultHook !== "auto" && hook) return `${hook.label} (default)`;
    if (defaultHook === "auto" && hook) return `${hook.label} (same name)`;
    return "no hook";
}

export async function configureHook(
    vscode: VscodeLike,
    theme: string,
    configuration: ConfigurationLike,
    getConfigurationTarget: (configuration: ConfigurationLike, setting: string) => ConfigurationTarget,
): Promise<void> {
    const themeHooks = configuration.get<unknown>("themeHooks", {});
    const defaultHook = configuration.get<unknown>("defaultHook", "auto");
    const choices: QuickPickChoice[] = [
        {
            label: "Automatic (Recommended)",
            description: `Remove this theme's override. Currently: ${describeHookResolution(
                theme,
                themeHooks,
                defaultHook,
            )}`,
            hookId: "auto",
        },
        {
            label: "No hook",
            description: "Explicitly disable hooks for this theme.",
            hookId: "none",
        },
        ...HOOKS.map((hook) => ({
            label: hook.label,
            description: `Use the predefined ${hook.label} hook for this theme.`,
            hookId: hook.id,
        })),
    ];
    const selected = await vscode.window.showQuickPick(choices, {
        placeHolder: `Hook for “${theme}”`,
    });
    const hookId = selected?.hookId;
    if (!hookId) return;

    if (hookId === "auto") {
        try {
            const target = getThemeHookOverrideTarget(configuration, theme, getConfigurationTarget, vscode);
            const current = getThemeHooksForTarget(configuration, target, vscode);
            let saved = false;
            if (Object.prototype.hasOwnProperty.call(current, theme)) {
                delete current[theme];
                await configuration.update("themeHooks", current, target);
                saved = true;
            }
            if (saved) void vscode.commands.executeCommand("markdown.preview.refresh");
            const updatedThemeHooks = configuration.get("themeHooks", {});
            const updatedDefaultHook = configuration.get("defaultHook", "auto");
            void vscode.window.showInformationMessage(
                `${saved ? "Removed the hook override" : "No hook override to remove"} for “${theme}”. Effective hook: ${describeHookResolution(
                    theme,
                    updatedThemeHooks,
                    updatedDefaultHook,
                )}.`,
            );
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            void vscode.window.showErrorMessage(`Failed to configure the hook for “${theme}”: ${message}`);
        }
        return;
    }

    const scope = await vscode.window.showQuickPick<ScopeChoice>(
        [
            {
                label: `Only “${theme}” (Recommended)`,
                description: "Save an override for this theme only.",
                scope: "theme",
            },
            {
                label: "Default for themes without an override",
                description: "Preserve every existing per-theme override.",
                scope: "default",
            },
            { label: "Cancel", scope: "cancel" },
        ],
        { placeHolder: "Where should this choice apply?" },
    );
    if (!scope || scope.scope === "cancel") return;

    try {
        let saved = false;
        if (scope.scope === "theme") {
            const target = getConfigurationTarget(configuration, "themeHooks");
            const current = getThemeHooksForTarget(configuration, target, vscode);
            if (current[theme] !== hookId) {
                current[theme] = hookId;
                await configuration.update("themeHooks", current, target);
                saved = true;
            }
        } else {
            await configuration.update(
                "defaultHook",
                hookId,
                getConfigurationTarget(configuration, "defaultHook"),
            );
            saved = true;
        }

        if (saved) void vscode.commands.executeCommand("markdown.preview.refresh");
        const updatedThemeHooks = configuration.get("themeHooks", {});
        const updatedDefaultHook = configuration.get("defaultHook", "auto");
        let message = `Hook for “${theme}” set to ${
            scope.scope === "theme" ? selected.label : `${selected.label} by default`
        }.`;
        if (scope.scope === "default" && isSettingsObject(updatedThemeHooks)) {
            const override = Object.prototype.hasOwnProperty.call(updatedThemeHooks, theme)
                ? updatedThemeHooks[theme]
                : undefined;
            if (override !== undefined) {
                const effectiveHook = resolveHook(theme, updatedThemeHooks, updatedDefaultHook);
                message += ` “${theme}” remains overridden with ${
                    effectiveHook ? effectiveHook.label : "no hook"
                }.`;
            }
        }
        void vscode.window.showInformationMessage(message);
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        void vscode.window.showErrorMessage(`Failed to configure the hook for “${theme}”: ${message}`);
    }
}

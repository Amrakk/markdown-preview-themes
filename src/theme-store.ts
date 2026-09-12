import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

export interface ThemeStoreOptions {
    readonly getFolderPath: () => unknown;
    readonly getWorkspaceFolder: () => string | undefined;
    readonly onChange?: () => void;
}

/** Resolves the configured folder using the first workspace folder for relative paths. */
export function resolveThemesFolder(folderPath: string | undefined, workspaceFolder?: string): string | null {
    if (!folderPath) return null;

    const expandedPath = folderPath.replace(/^~(?=$|[\\/])/, os.homedir());
    return path.resolve(workspaceFolder || "", expandedPath);
}

export class ThemeStore {
    private readonly themes = new Map<string, string>();
    private watcher: fs.FSWatcher | null = null;

    constructor(private readonly options: ThemeStoreOptions) {}

    refresh(): void {
        this.themes.clear();
        const absolutePath = this.folderPath();
        if (!absolutePath) return;

        try {
            for (const file of fs.readdirSync(absolutePath, { withFileTypes: true })) {
                if (!file.isFile() || path.extname(file.name) !== ".css") continue;

                const themeName = path.basename(file.name, ".css");
                if (!themeName) continue;

                try {
                    this.themes.set(themeName, fs.readFileSync(path.join(absolutePath, file.name), "utf8"));
                } catch (error) {
                    console.error(`Error reading theme file ${file.name}:`, errorMessage(error));
                }
            }
        } catch (error) {
            console.error("Error scanning themes folder:", errorMessage(error));
        }
    }

    watch(): void {
        this.watcher?.close();
        this.watcher = null;
        this.refresh();

        const absolutePath = this.folderPath();
        if (!absolutePath) return;

        try {
            const watcher = fs.watch(absolutePath, () => {
                this.refresh();
                this.options.onChange?.();
            });
            watcher.on("error", (error) => {
                console.error("Error watching themes folder:", errorMessage(error));
            });
            this.watcher = watcher;
        } catch (error) {
            console.error("Error watching themes folder:", errorMessage(error));
        }
    }

    has(themeName: string): boolean {
        return this.themes.has(themeName);
    }

    getCss(themeName: string): string | null {
        return this.themes.get(themeName) ?? null;
    }

    names(): Set<string> {
        return new Set(this.themes.keys());
    }

    dispose(): void {
        this.watcher?.close();
        this.watcher = null;
    }

    private folderPath(): string | null {
        const configured = this.options.getFolderPath();
        return resolveThemesFolder(
            typeof configured === "string" ? configured : undefined,
            this.options.getWorkspaceFolder(),
        );
    }
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

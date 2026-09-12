import * as esbuild from "esbuild";

const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");
const options = {
    entryPoints: ["src/extension.ts"],
    bundle: true,
    format: "cjs",
    platform: "node",
    outfile: "dist/extension.js",
    external: ["vscode"],
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    metafile: production,
};

if (watch) {
    const context = await esbuild.context(options);
    await context.watch();
} else {
    const result = await esbuild.build(options);
    if (production && result.metafile) {
        console.log(await esbuild.analyzeMetafile(result.metafile));
    }
}

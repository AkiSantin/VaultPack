import esbuild from "esbuild";
import process from "node:process";
import builtins from "node:module";

const production = process.argv[2] === "production";

// Obsidian plugin build: bundle src/main.ts into a single CommonJS main.js.
// "obsidian" / "electron" / codemirror packages are provided by the Obsidian app
// at runtime and must stay external (official sample-plugin convention).
const context = await esbuild.context({
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: [
    "obsidian",
    "electron",
    "@codemirror/autocomplete",
    "@codemirror/collab",
    "@codemirror/commands",
    "@codemirror/language",
    "@codemirror/lint",
    "@codemirror/search",
    "@codemirror/state",
    "@codemirror/view",
    "@lezer/common",
    "@lezer/highlight",
    "@lezer/lr",
    ...builtins.builtinModules,
  ],
  format: "cjs",
  target: "es2021",
  logLevel: "info",
  sourcemap: production ? false : "inline",
  treeShaking: true,
  outfile: "main.js",
  minify: false,
});

if (production) {
  await context.rebuild();
  process.exit(0);
} else {
  await context.rebuild();
  process.exit(0);
}

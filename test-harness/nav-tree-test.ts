/** Headless unit check for the sidebar tree: nested folders, EMPTY folders
 * (Obsidian-explorer parity, user req 2026-07-04), BASE flags, sorting. */
import { buildNavIndexJs } from "../src/nav-assets";

const js = buildNavIndexJs(
	"t",
	[
		{ path: "books/合集之書.md", title: "合集之書", url: "notes/a.html", kind: "note" },
		{ path: "books/more folder/nested note.md", title: "nested note", url: "notes/b.html", kind: "note" },
		{ path: "共用.base", title: "共用", url: "notes/c.html", kind: "base" },
		{ path: "more file.md", title: "more file", url: "notes/d.html", kind: "note" },
	],
	["books", "books/more folder", "books/empty sub", "top empty"],
);
const nav = JSON.parse(js.replace(/^window\.NP_NAV=/, "").replace(/;\n$/, ""));
const t = JSON.stringify(nav.tree);
const checks: Array<[string, boolean]> = [
	["books folder exists", t.includes('"t":"books"')],
	["nested note under more folder",
		JSON.stringify(nav.tree[0]).includes('"t":"more folder"') &&
		JSON.stringify(nav.tree[0]).includes("nested note")],
	["EMPTY folder present (empty sub)", t.includes('"t":"empty sub"')],
	["EMPTY top-level folder present", t.includes('"t":"top empty"')],
	["base flag", t.includes('"b":1')],
	["root file at root", nav.tree.some((n: { t: string; u?: string }) => n.t === "more file" && n.u !== undefined)],
];
let fails = 0;
for (const [name, ok] of checks) {
	console.log((ok ? "PASS " : "FAIL ") + name);
	if (!ok) fails++;
}
process.exit(fails === 0 ? 0 : 1);

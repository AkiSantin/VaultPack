import {
	App,
	Component,
	MarkdownRenderer,
	Notice,
	PluginManifest,
	TFile,
	WorkspaceLeaf,
} from "obsidian";
import { NpLocale, resolveLocale, t } from "./i18n";
import {
	PageChrome,
	PageSecurity,
	buildPage,
	escapeHtml,
	footer,
	plainTextOf,
} from "./html-page";
import { ModePlan, makeModePlan } from "./export-mode";
import { privateDenyHtaccess, robotsTxt, rootHtaccess } from "./web-security";
import { buildPhpGate, hashPassword } from "./php-gate";
import { createEncryptedZip } from "./zip-aes";
import { NAV_JS, NavEntry, buildNavIndexJs } from "./nav-assets";
import { uiT } from "./ui-i18n";
import { SEARCH_JS, SearchEntry, buildSearchIndexJs } from "./search-assets";
import { PAGE_CSS, TOKENS_CSS } from "./design-tokens";
import {
	NameRegistry,
	ViewSpec,
	basePageFile,
	buildCoverMap,
	createNewExportFolder,
	ensureFolder,
	extractViews,
	notePageFile,
	sanitizeFileName,
	viewAnchorId,
} from "./vault-io";
import { resolveAbsolutePath, tryOpenInBrowser } from "./open-external";
import { NoteExportCtx, writeNotePages } from "./note-export";
import {
	FoundResult,
	findAllQueryResults,
	findQueryResult,
	ownerViewType,
	renderSemanticTable,
	renderSemanticView,
	RenderedTable,
} from "./bases-query";

/** shared stylesheet hrefs, relative to pages inside notes/ and to the root */
const CSS_FROM_NOTES = ["../_notepack/theme.css", "../_notepack/base.css"];
const CSS_FROM_ROOT = ["_notepack/theme.css", "_notepack/base.css"];
/** sidebar + mobile-bar wiring (title/search/tree — user req 2026-07-04) */
const chromeFromNotes = (packageTitle: string): PageChrome => ({
	homeHref: "../START_HERE.html",
	rootPrefix: "../",
	notepackBase: "../_notepack/",
	packageTitle,
});
const chromeFromRoot = (packageTitle: string): PageChrome => ({
	homeHref: "START_HERE.html",
	rootPrefix: "",
	notepackBase: "_notepack/",
	packageTitle,
});

export interface BasesExportSummary {
	/** package root (mode artifacts live here; content may nest deeper) */
	exportFolder: string;
	pages: PageResult[];
	notePageCount: number;
	noteProblems: string[];
	openedPath: string | null;
	openedWith: string | null;
	/** encrypted-zip mode: the produced archive (vault-relative) */
	zipPath: string | null;
}
export interface PageResult {
	basePath: string;
	outFile: string;
	viewCount: number;
	rowCount: number;
	columnCount: number;
	groupCount: number;
	entryPaths: string[];
	/** plain text for the offline search index */
	indexText: string;
	problems: string[];
}


/**
 * Contained single-note export: the ACTIVE note only. Same package layout as
 * the full export (notes/note-<hash>.html, _notepack/, assets/).
 */
export async function exportActiveNote(
	app: App,
	manifest: PluginManifest,
	owner: Component,
	file?: TFile,
	plan: ModePlan = makeModePlan("local"),
): Promise<{
	exportFolder: string;
	outPath: string;
	problems: string[];
	zipPath: string | null;
}> {
	const locale = resolveLocale();
	const f = file ?? app.workspace.getActiveFile();
	if (f === null || f.extension !== "md") {
		throw new Error(uiT(locale, "errNoActiveNote"));
	}
	const exportRoot = await createNewExportFolder(
		app,
		"vaultpack",
		plan.exactFolderName ?? undefined,
		locale,
	);
	const contentRoot = await prepareContentRoot(app, exportRoot, plan);
	await writeSharedStyles(app, contentRoot, captureAccent().css);
	const noteCtx: NoteExportCtx = {
		exportFolder: contentRoot,
		noteSlugs: new Map([[f.path, notePageFile(f.path)]]),
		basePages: new Set(),
		assets: new Map(),
		oembedCache: new Map(),
		searchIndex: [],
		security: pageSecurityOf(plan),
		problems: [],
		debug: [],
	};
	await writeNotePages(app, manifest, locale, owner, noteCtx, CSS_FROM_NOTES);
	await writeSystemFiles(app, contentRoot, {
		startedAt: new Date().toISOString(),
		manifestVersion: manifest.version,
		mode: "active-note",
		exportMode: plan.mode,
		notes: noteCtx.debug,
		noteProblems: noteCtx.problems,
	}, {
		urlMap: new Map([[f.path, `notes/${notePageFile(f.path)}`]]),
		noteIndex: [
			{ path: f.path, title: f.basename, file: `notes/${notePageFile(f.path)}` },
		],
		assets: noteCtx.assets,
	}, plan);
	await writeModeArtifacts(app, exportRoot, contentRoot, plan, locale, manifest);
	const zipPath = await maybeZip(app, exportRoot, plan, null, locale);
	const outPath = `${contentRoot}/notes/${notePageFile(f.path)}`;
	await tryOpenInBrowser(app, outPath, resolveAbsolutePath(app, outPath));
	return { exportFolder: exportRoot, outPath, problems: noteCtx.problems, zipPath };
}

/** Scope input for exportScoped (REQUIREMENTS 硬需求 5：範圍自選). */
export interface ScopeInput {
	title: string;
	baseFiles: TFile[];
	/** notes included by the scope itself (beyond base entries) */
	extraNotes: TFile[];
	/** real folder paths within the scope — sidebar mirrors Obsidian's
	 * explorer incl. empty folders (user req 2026-07-04) */
	folderPaths?: string[];
}

/** Back-compat wrapper: every .base + referenced notes. */
export async function exportAllBases(
	app: App,
	manifest: PluginManifest,
	owner: Component,
	plan: ModePlan = makeModePlan("local"),
	customTitle?: string,
): Promise<BasesExportSummary> {
	return exportScoped(
		app,
		manifest,
		owner,
		{
			title: customTitle ?? app.vault.getName(),
			baseFiles: app.vault
				.getFiles()
				.filter((f) => f.extension === "base")
				.sort((a, b) => a.path.localeCompare(b.path)),
			extraNotes: [],
		},
		null,
		plan,
	);
}

/** Page hardening flags for this plan (null → buildPage default off). */
function pageSecurityOf(plan: ModePlan): PageSecurity | undefined {
	if (!plan.noindexMeta && !plan.noReferrerMeta && !plan.relNoreferrer) {
		return undefined;
	}
	return {
		noindexMeta: plan.noindexMeta,
		noReferrerMeta: plan.noReferrerMeta,
		relNoreferrer: plan.relNoreferrer,
	};
}

/** password mode nests ALL content in _np_private_<token>/ (spec §5.1). */
async function prepareContentRoot(
	app: App,
	exportRoot: string,
	plan: ModePlan,
): Promise<string> {
	if (plan.privateSubdir === null) {
		return exportRoot;
	}
	const contentRoot = `${exportRoot}/${plan.privateSubdir}`;
	await ensureFolder(app, contentRoot);
	return contentRoot;
}

/** Raw write for dotfiles (vault.create refuses hidden paths) — still
 * no-overwrite: loud fail when the destination already exists. */
async function createRaw(
	app: App,
	path: string,
	content: string,
	locale: NpLocale,
): Promise<void> {
	if (await app.vault.adapter.exists(path)) {
		throw new Error(uiT(locale, "errFileExists", { path }));
	}
	await app.vault.adapter.write(path, content);
}

/**
 * Per-mode package artifacts (spec §4/§5/§6):
 * robots.txt (all modes, package root), root .htaccess (web modes),
 * PHP gate + private deny + probe (password mode).
 */
async function writeModeArtifacts(
	app: App,
	exportRoot: string,
	contentRoot: string,
	plan: ModePlan,
	locale: NpLocale,
	manifest: PluginManifest,
): Promise<void> {
	await app.vault.create(`${exportRoot}/robots.txt`, robotsTxt());
	const ht = rootHtaccess(plan);
	if (ht !== null) {
		await createRaw(app, `${exportRoot}/.htaccess`, ht, locale);
	}
	if (plan.mode === "password") {
		if (plan.password === null || plan.privateSubdir === null) {
			throw new Error(uiT(locale, "errPasswordMissing"));
		}
		await createRaw(
			app,
			`${contentRoot}/.htaccess`,
			privateDenyHtaccess(),
			locale,
		);
		const gate = buildPhpGate({
			privateSubdir: plan.privateSubdir,
			passwordHash: hashPassword(plan.password),
			locale,
			version: manifest.version,
			rememberDays: plan.rememberDays,
		});
		await app.vault.create(`${contentRoot}/${gate.probeName}`, gate.probeContent);
		await app.vault.create(`${exportRoot}/index.php`, gate.indexPhp);
		await app.vault.create(`${exportRoot}/logout.php`, gate.logoutPhp);
	}
	if (plan.mode === "local" || plan.mode === "zip") {
		// local preservation keeps the old header hints; web modes ship the
		// real .htaccess instead.
		await app.vault.create(
			`${contentRoot}/_notepack/server-headers-example.txt`,
			[
				"# Suggested headers when hosting this package",
				"Content-Type: text/html; charset=utf-8   (for .html)",
				"Referrer-Policy: strict-origin-when-cross-origin",
				"X-Content-Type-Options: nosniff",
			].join("\n"),
		);
	}
}

/** zip mode: pack the finished package into an AES-256 archive (§2.1). */
async function maybeZip(
	app: App,
	exportRoot: string,
	plan: ModePlan,
	progress: Notice | null,
	locale: NpLocale,
): Promise<string | null> {
	if (!plan.zipAfter) {
		return null;
	}
	if (plan.password === null) {
		throw new Error(uiT(locale, "errPasswordMissing"));
	}
	const r = await createEncryptedZip(
		app,
		exportRoot,
		plan.password,
		locale,
		(done, total) => {
			if (done % 20 === 0 || done === total) {
				progress?.setMessage(
					uiT(locale, "progressZipping", { done, total }),
				);
			}
		},
	);
	return r.zipPath;
}

/** Export the given scope: base pages + note pages + START_HERE + _notepack. */
export async function exportScoped(
	app: App,
	manifest: PluginManifest,
	owner: Component,
	input: ScopeInput,
	progress: Notice | null,
	plan: ModePlan = makeModePlan("local"),
): Promise<BasesExportSummary> {
	const locale = resolveLocale();
	const debug: Record<string, unknown> = {
		startedAt: new Date().toISOString(),
		manifestVersion: manifest.version,
		scopeTitle: input.title,
		exportMode: plan.mode,
		bases: [],
	};

	const baseFiles = input.baseFiles;
	if (baseFiles.length === 0 && input.extraNotes.length === 0) {
		throw new Error(uiT(locale, "errEmptyScope"));
	}

	const exportRoot = await createNewExportFolder(
		app,
		"vaultpack",
		plan.exactFolderName ?? undefined,
		locale,
	);
	const exportFolder = await prepareContentRoot(app, exportRoot, plan);
	const security = pageSecurityOf(plan);
	const accent = captureAccent();
	debug.accentCaptured = accent.raw;
	await writeSharedStyles(app, exportFolder, accent.css);
	await ensureFolder(app, `${exportFolder}/notes`);

	const registry = new NameRegistry(locale);
	const pages: PageResult[] = [];
	const assets = new Map<string, string>();
	const searchIndex: SearchEntry[] = [];

	for (let i = 0; i < baseFiles.length; i++) {
		const baseFile = baseFiles[i];
		progress?.setMessage(
			uiT(locale, "progressBase", {
				i: i + 1,
				n: baseFiles.length,
				name: baseFile.basename,
			}),
		);
		registry.claim(basePageFile(baseFile.path), baseFile.path);
		const page = await exportOneBase(
			app,
			manifest,
			locale,
			baseFile,
			exportFolder,
			debug.bases as Array<Record<string, unknown>>,
			owner,
			assets,
			security,
			chromeFromNotes(input.title),
		);
		pages.push(page);
		searchIndex.push({
			t: baseTitleOf(baseFile.path),
			u: `notes/${page.outFile}`,
			x: page.indexText,
		});
	}

	// Note pages: scope's own notes + every note referenced by any base row.
	const notePaths = new Set<string>();
	for (const f of input.extraNotes) {
		notePaths.add(f.path);
	}
	for (const p of pages) {
		for (const np of p.entryPaths) {
			notePaths.add(np);
		}
	}
	const noteSlugs = new Map<string, string>();
	for (const p of [...notePaths].sort()) {
		const file = notePageFile(p);
		registry.claim(file, p);
		noteSlugs.set(p, file);
	}
	const noteCtx: NoteExportCtx = {
		exportFolder,
		noteSlugs,
		basePages: new Set(baseFiles.map((f) => f.path)),
		assets,
		oembedCache: new Map(),
		searchIndex,
		security,
		problems: [],
		debug: [],
	};
	const notePageCount = await writeNotePages(
		app,
		manifest,
		locale,
		owner,
		noteCtx,
		CSS_FROM_NOTES,
		(done, total) => {
			if (done % 10 === 0 || done === total) {
				progress?.setMessage(
					uiT(locale, "progressNotes", { done, total }),
				);
			}
		},
		chromeFromNotes(input.title),
	);
	debug.notePageCount = notePageCount;
	debug.notes = noteCtx.debug;
	debug.noteProblems = noteCtx.problems;

	// START_HERE.html — the single human entry point (spec rule):
	// bases first, then a folder-grouped index of every exported note.
	const basesSection =
		pages.length > 0
			? `<section class="np-start-sec"><h2 class="np-view-title">Bases</h2><ul class="np-list">` +
				pages
					.map(
						(p) =>
							`<li><a class="np-note-link" href="notes/${escapeHtml(p.outFile)}">${escapeHtml(baseTitleOf(p.basePath))}</a>` +
							`<div class="np-list-sub"><span class="np-sub-prop">${p.viewCount} views · ${p.rowCount} rows</span></div></li>`,
					)
					.join("\n") +
				`</ul></section>`
			: "";
	const startBody =
		`<h1>${escapeHtml(input.title)}</h1>` +
		`<div class="np-meta">` +
		`<span>${t(locale, "generatedAt")}: ${escapeHtml(new Date().toLocaleString())}</span>` +
		`<span>${t(locale, "rows", { n: notePageCount })}</span>` +
		`</div>` +
		basesSection +
		notesIndexHtml(noteSlugs) +
		footer(locale, manifest);
	await app.vault.create(
		`${exportFolder}/START_HERE.html`,
		buildPage({
			locale,
			title: input.title,
			bodyHtml: startBody,
			cssHrefs: CSS_FROM_ROOT,
			chrome: chromeFromRoot(input.title),
			pagePath: "START_HERE.html",
			security,
		}),
	);

	// offline search assets (classic scripts — file:// blocks fetch()).
	await app.vault.create(
		`${exportFolder}/_notepack/search-index.js`,
		buildSearchIndexJs(searchIndex, locale),
	);
	await app.vault.create(`${exportFolder}/_notepack/search.js`, SEARCH_JS);

	// sidebar navigation assets (folder/file tree — user req 2026-07-04)
	const navEntries: NavEntry[] = [
		...pages.map(
			(p): NavEntry => ({
				path: p.basePath,
				title: baseTitleOf(p.basePath),
				url: `notes/${p.outFile}`,
				kind: "base",
			}),
		),
		...[...noteSlugs.entries()].map(
			([p, file]): NavEntry => ({
				path: p,
				title: (p.split("/").pop() ?? p).replace(/\.md$/u, ""),
				url: `notes/${file}`,
				kind: "note",
			}),
		),
	];
	await app.vault.create(
		`${exportFolder}/_notepack/nav-index.js`,
		buildNavIndexJs(input.title, navEntries, input.folderPaths ?? []),
	);
	await app.vault.create(`${exportFolder}/_notepack/nav.js`, NAV_JS);

	// _notepack/ machine-readable maps + report + web-hosting extras.
	const urlMap = new Map<string, string>();
	for (const p of pages) {
		urlMap.set(p.basePath, `notes/${p.outFile}`);
	}
	for (const [p, file] of noteSlugs) {
		urlMap.set(p, `notes/${file}`);
	}
	debug.problems = pages.flatMap((p) => p.problems);
	await writeSystemFiles(app, exportFolder, debug, {
		urlMap,
		noteIndex: [...noteSlugs.entries()].map(([p, file]) => ({
			path: p,
			title: p.replace(/\.md$/u, "").split("/").pop() ?? p,
			file: `notes/${file}`,
		})),
		assets,
	}, plan);
	await writeModeArtifacts(app, exportRoot, exportFolder, plan, locale, manifest);
	progress?.setMessage(uiT(locale, "progressPacking"));
	const zipPath = await maybeZip(app, exportRoot, plan, progress, locale);

	const openedPath = `${exportFolder}/START_HERE.html`;
	const openedWith = await tryOpenInBrowser(
		app,
		openedPath,
		resolveAbsolutePath(app, openedPath),
	);
	return {
		exportFolder: exportRoot,
		pages,
		notePageCount,
		noteProblems: noteCtx.problems,
		openedPath,
		openedWith,
		zipPath,
	};
}

function baseTitleOf(basePath: string): string {
	const name = basePath.split("/").pop() ?? basePath;
	return name.replace(/\.base$/u, "");
}

/** START_HERE note index: grouped by top-level folder, human titles only. */
function notesIndexHtml(noteSlugs: Map<string, string>): string {
	if (noteSlugs.size === 0) {
		return "";
	}
	const groups = new Map<string, Array<[string, string]>>();
	for (const [p, file] of noteSlugs) {
		const top = p.includes("/") ? p.slice(0, p.indexOf("/")) : "／";
		let arr = groups.get(top);
		if (arr === undefined) {
			arr = [];
			groups.set(top, arr);
		}
		arr.push([p, file]);
	}
	return [...groups.entries()]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(
			([g, items]) =>
				`<section class="np-start-sec"><h2 class="np-view-title">${escapeHtml(g)}</h2><ul class="np-list">` +
				items
					.map(
						([p, file]) =>
							`<li><a class="np-note-link" href="notes/${escapeHtml(file)}">${escapeHtml(
								(p.split("/").pop() ?? p).replace(/\.md$/u, ""),
							)}</a></li>`,
					)
					.join("") +
				`</ul></section>`,
		)
		.join("\n");
}

/**
 * The user's Obsidian accent color, captured at export time (user req
 * 2026-07-04: exported links + task icons follow the app's accent setting).
 *
 * Probe-element technique: reading the custom property off document.body
 * returned "" in the user's Obsidian (disk evidence 2026-07-04, package
 * 202241 had no override block). An element with
 * `color: var(--interactive-accent)` always computes to a resolved rgb()
 * — with a same-as-body-text guard so an undefined var can't smuggle the
 * text color in as "accent". Empty result → the Notion-blue default stays.
 */
function captureAccent(): { css: string; raw: string } {
	try {
		const probe = document.createElement("span");
		probe.style.color = "var(--interactive-accent)";
		probe.style.position = "fixed";
		probe.style.left = "-9999px";
		document.body.appendChild(probe);
		const resolved = getComputedStyle(probe).color.trim();
		const bodyText = getComputedStyle(document.body).color.trim();
		probe.remove();
		if (
			/^rgba?\([\d.,\s%/]+\)$/iu.test(resolved) &&
			resolved !== bodyText
		) {
			return {
				css: `\n/* captured from the user's Obsidian accent setting */\n:root { --np-color-accent: ${resolved}; }\n`,
				raw: resolved,
			};
		}
	} catch {
		/* keep the token default */
	}
	return { css: "", raw: "" };
}

async function writeSharedStyles(
	app: App,
	exportFolder: string,
	accentCss: string,
): Promise<void> {
	await ensureFolder(app, `${exportFolder}/_notepack`);
	await app.vault.create(
		`${exportFolder}/_notepack/theme.css`,
		TOKENS_CSS + accentCss,
	);
	await app.vault.create(`${exportFolder}/_notepack/base.css`, PAGE_CSS);
}

/**
 * Diagnostics sidecars (url-map / note-index / asset maps / report).
 * Web modes skip them entirely by default (spec §3.2: never publish
 * developer/debug metadata) — verified: no exported page reads these at
 * runtime. robots.txt / .htaccess moved to writeModeArtifacts.
 */
async function writeSystemFiles(
	app: App,
	exportFolder: string,
	debug: Record<string, unknown>,
	data: {
		urlMap: Map<string, string>;
		noteIndex: Array<{ path: string; title: string; file: string }>;
		assets: Map<string, string>;
	},
	plan: ModePlan,
): Promise<void> {
	if (!plan.diagnostics) {
		return;
	}
	const dir = `${exportFolder}/_notepack`;
	await ensureFolder(app, dir);
	const j = (v: unknown) => JSON.stringify(v, null, 2);
	await app.vault.create(
		`${dir}/url-map.json`,
		j(Object.fromEntries(data.urlMap)),
	);
	await app.vault.create(`${dir}/note-index.json`, j(data.noteIndex));
	const assetEntries = Object.fromEntries(data.assets);
	await app.vault.create(`${dir}/asset-map.json`, j(assetEntries));
	await app.vault.create(
		`${dir}/attachment-manifest.json`,
		j(Object.values(assetEntries).map((name) => `assets/${name}`)),
	);
	await app.vault.create(`${dir}/export-report.json`, j(debug));
	const problems =
		(debug.noteProblems as string[] | undefined) ?? ([] as string[]);
	await app.vault.create(
		`${dir}/export-report.html`,
		buildPage({
			locale: "en",
			title: "VaultPack export report",
			bodyHtml:
				`<h1>Export report</h1>` +
				`<p>${escapeHtml(String(debug.startedAt ?? ""))} — v${escapeHtml(String(debug.manifestVersion ?? ""))}</p>` +
				`<p>problems: ${problems.length}</p>` +
				`<pre class="np-raw">${escapeHtml(problems.join("\n"))}</pre>`,
			cssHrefs: ["theme.css", "base.css"],
		}),
	);
}

async function exportOneBase(
	app: App,
	manifest: PluginManifest,
	locale: NpLocale,
	baseFile: TFile,
	exportFolder: string,
	debugList: Array<Record<string, unknown>>,
	owner: Component,
	assets: Map<string, string>,
	security?: PageSecurity,
	chrome?: PageChrome,
): Promise<PageResult> {
	const problems: string[] = [];
	const dbg: Record<string, unknown> = { basePath: baseFile.path };
	debugList.push(dbg);

	const views = extractViews(await app.vault.cachedRead(baseFile));
	dbg.viewsParsed = views;

	// base pages live in notes/ → note links are same-directory
	const hrefForNote = (p: string) => notePageFile(p);

	let sectionsHtml = "";
	let rowCount = 0;
	let columnCount = 0;
	let groupCount = 0;
	const entryPaths = new Set<string>();

	if (views.length > 0) {
		const sections = await renderAllViews(
			app,
			owner,
			baseFile,
			views,
			locale,
			problems,
			hrefForNote,
			dbg,
			exportFolder,
			assets,
		);
		sectionsHtml +=
			`<div class="np-view-tabs">` +
			views
				.map(
					(v) =>
						`<button class="np-view-tab" data-view="${escapeHtml(viewAnchorId(v.name))}">${escapeHtml(v.name)}</button>`,
				)
				.join("") +
			`</div>`;
		for (const s of sections) {
			sectionsHtml += s.html;
			if (s.table !== null) {
				rowCount += s.table.rowCount;
				columnCount = Math.max(columnCount, s.table.columnCount);
				groupCount += s.table.groupCount;
				for (const p of s.table.entryPaths) {
					entryPaths.add(p);
				}
			}
		}
	} else {
		problems.push("view-names-unparsed");
		const leaf = app.workspace.getLeaf("tab");
		let rendered: RenderedTable | null = null;
		try {
			await leaf.openFile(baseFile, { active: false });
			const waited = await waitForQueryResult(leaf, 10_000);
			dbg.fallbackFoundPath = waited.found?.path ?? null;
			if (waited.found !== null) {
				rendered = renderSemanticTable(
					waited.found,
					locale,
					problems,
					hrefForNote,
				);
			}
		} finally {
			leaf.detach();
		}
		if (rendered === null) {
			problems.push("no-query-data");
			sectionsHtml =
				`<div class="np-error"><h2>${t(locale, "errorTitle")}</h2>` +
				`<p>${t(locale, "errorNoQueryData")}</p></div>`;
		} else {
			sectionsHtml = rendered.html;
			rowCount = rendered.rowCount;
			columnCount = rendered.columnCount;
			groupCount = rendered.groupCount;
			for (const p of rendered.entryPaths) {
				entryPaths.add(p);
			}
		}
	}

	const meta =
		`<div class="np-meta">` +
		`<span>${t(locale, "generatedAt")}: ${escapeHtml(new Date().toLocaleString())}</span>` +
		`<span>${t(locale, "sourceVault")}: ${escapeHtml(app.vault.getName())}</span>` +
		`<span>${t(locale, "sourceBase")}: ${escapeHtml(baseFile.path)}</span>` +
		`<span>${t(locale, "rows", { n: rowCount })}</span>` +
		`</div>`;
	const bodyHtml =
		`<h1>${escapeHtml(baseFile.basename)}</h1>` +
		meta +
		sectionsHtml +
		footer(locale, manifest);

	const outFile = basePageFile(baseFile.path);
	await app.vault.create(
		`${exportFolder}/notes/${outFile}`,
		buildPage({
			locale,
			title: baseFile.basename,
			bodyHtml,
			wide: true,
			cssHrefs: CSS_FROM_NOTES,
			chrome,
			pagePath: `notes/${outFile}`,
			security,
		}),
	);
	dbg.outFile = outFile;
	dbg.problems = problems;
	return {
		basePath: baseFile.path,
		outFile,
		viewCount: views.length,
		rowCount,
		columnCount,
		groupCount,
		entryPaths: [...entryPaths],
		indexText: plainTextOf(sectionsHtml),
		problems,
	};
}

interface ViewSection {
	name: string;
	html: string;
	table: RenderedTable | null;
}

/** One section per named view, each with an anchor for direct linking. */
async function renderAllViews(
	app: App,
	owner: Component,
	baseFile: TFile,
	views: ViewSpec[],
	locale: NpLocale,
	problems: string[],
	hrefForNote: (p: string) => string | null,
	dbg: Record<string, unknown>,
	exportFolder: string,
	assets: Map<string, string>,
): Promise<ViewSection[]> {
	const md = views.map((v) => `![[${baseFile.name}#${v.name}]]`).join("\n\n");
	const host = document.createElement("div");
	host.style.position = "fixed";
	host.style.left = "-99999px";
	host.style.width = "1000px";
	document.body.appendChild(host);
	const renderOwner = new Component();
	owner.addChild(renderOwner);
	const sections: ViewSection[] = [];
	try {
		await MarkdownRenderer.render(app, md, host, baseFile.path, renderOwner);
		const deadline = Date.now() + 10_000;
		let hits = findAllQueryResults(renderOwner, views.length + 4);
		while (hits.length < views.length && Date.now() < deadline) {
			await sleep(250);
			hits = findAllQueryResults(renderOwner, views.length + 4);
		}
		dbg.viewHits = hits.length;
		const spans = Array.from(host.querySelectorAll(".internal-embed"));
		for (let i = 0; i < views.length; i++) {
			const v = views[i];
			const span = spans[i];
			const hit =
				span !== undefined
					? hits.find((h) => {
							const el = (h.owner as { containerEl?: unknown } | null)
								?.containerEl;
							return el instanceof HTMLElement && span.contains(el);
						})
					: undefined;
			let table: RenderedTable | null = null;
			let inner: string;
			if (hit !== undefined) {
				// summaries runtime diagnostics (minified-internals suspicion)
				dbg[`sum-${v.name}`] = {
					cfg: v.summaries,
					hasFn: typeof (
						hit.q as unknown as { getSummaryValue?: unknown }
					).getSummaryValue,
					hasController:
						(hit.owner as { controller?: unknown } | null)?.controller !==
						undefined,
					qProtoKeys: Object.getOwnPropertyNames(
						Object.getPrototypeOf(hit.q) ?? {},
					).slice(0, 25),
				};
				const runtimeType = ownerViewType(hit.owner) ?? v.type;
				const coverMap =
					runtimeType === "cards"
						? await buildCoverMap(
								app,
								hit,
								baseFile.path,
								exportFolder,
								assets,
								"../assets/",
							)
						: new Map<string, string>();
				const entrySet = new Set(
					hit.q.data
						.map((e) => e.file?.path)
						.filter((p): p is string => p !== undefined),
				);
				const resolveWikilink = (target: string): string | null => {
					const hash = target.indexOf("#");
					const linkpath = hash >= 0 ? target.slice(0, hash) : target;
					const dest = app.metadataCache.getFirstLinkpathDest(
						linkpath,
						baseFile.path,
					);
					if (dest === null || !entrySet.has(dest.path)) {
						return null;
					}
					return hrefForNote(dest.path);
				};
				table = renderSemanticView(
					hit,
					runtimeType,
					locale,
					problems,
					hrefForNote,
					(entry) => coverMap.get(entry.file?.path ?? "") ?? null,
					resolveWikilink,
					v.summaries,
				);
				const supported =
					table.renderedAs === runtimeType || runtimeType === "table";
				const typeNote = supported
					? ""
					: `<div class="np-banner">${t(locale, "viewTypeFallback", { type: runtimeType })}</div>`;
				inner = typeNote + table.html;
			} else {
				problems.push(`view-no-data:${baseFile.path}#${v.name}`);
				inner =
					`<div class="np-error"><h2>${t(locale, "errorTitle")}</h2>` +
					`<p>${escapeHtml(`#${v.name}`)} — ${t(locale, "errorNoQueryData")}</p></div>`;
			}
			sections.push({
				name: v.name,
				table,
				html:
					`<section class="np-view" id="${escapeHtml(viewAnchorId(v.name))}">` +
					`<h2 class="np-view-title">${escapeHtml(v.name)}</h2>` +
					inner +
					`</section>`,
			});
		}
	} finally {
		owner.removeChild(renderOwner);
		renderOwner.unload();
		host.remove();
	}
	return sections;
}

async function waitForQueryResult(
	leaf: WorkspaceLeaf,
	timeoutMs: number,
): Promise<{
	found: FoundResult | null;
	samples: Array<Record<string, unknown>>;
}> {
	const stepMs = 250;
	const samples: Array<Record<string, unknown>> = [];
	let lastCount = -1;
	for (let waited = 0; waited < timeoutMs; waited += stepMs) {
		await sleep(stepMs);
		const hit = findQueryResult(leaf.view);
		samples.push({
			waitedMs: waited + stepMs,
			foundPath: hit?.path ?? null,
			dataLen: hit?.q.data.length ?? null,
		});
		if (hit !== null) {
			if (hit.q.data.length === lastCount) {
				return { found: hit, samples };
			}
			lastCount = hit.q.data.length;
		}
	}
	return { found: null, samples };
}

function sleep(ms: number): Promise<void> {
	return new Promise((r) => setTimeout(r, ms));
}

// re-export for callers that only import from base-export
export { sanitizeFileName };

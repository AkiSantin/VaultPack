import {
	App,
	Component,
	FileSystemAdapter,
	MarkdownRenderer,
	PluginManifest,
	TFile,
} from "obsidian";
import { NpLocale, t } from "./i18n";
import {
	PageChrome,
	PageSecurity,
	buildPage,
	escapeHtml,
	footer,
	plainTextOf,
} from "./html-page";
import { SearchEntry } from "./search-assets";
import {
	basePageFile,
	buildCoverMap,
	copyAssetToExport,
	ensureFolder,
	viewAnchorId,
	viewSummariesFor,
} from "./vault-io";
import {
	findAllQueryResults,
	ownerViewType,
	renderSemanticView,
} from "./bases-query";
import { OembedCard, replaceExternalEmbeds } from "./oembed";
import { checkboxSvg } from "./checkbox-icons";

export interface NoteExportCtx {
	exportFolder: string;
	/** every note being exported in this run: vault path → slug */
	noteSlugs: Map<string, string>;
	/** vault paths of .base files whose pages exist in this export */
	basePages: Set<string>;
	/** copied binaries: vault path → asset file name under assets/ */
	assets: Map<string, string>;
	/** external-embed oEmbed results, cached per page URL for this run */
	oembedCache: Map<string, OembedCard | null>;
	/** offline search index entries, appended per exported page */
	searchIndex: SearchEntry[];
	/** web-mode page hardening (noindex / no-referrer / rel) — spec §4.2 */
	security?: PageSecurity;
	problems: string[];
	debug: Array<Record<string, unknown>>;
}

/**
 * Phase 4: real note pages — properties block (frontmatter) + markdown body
 * rendered by Obsidian's own MarkdownRenderer, then post-processed for offline
 * use (internal links → exported pages; images copied into assets/).
 * Render failures fall back to a loud error banner + raw source, never blank.
 */
export async function writeNotePages(
	app: App,
	manifest: PluginManifest,
	locale: NpLocale,
	owner: Component,
	ctx: NoteExportCtx,
	cssHrefs: string[],
	onProgress?: (done: number, total: number) => void,
	chrome?: PageChrome,
): Promise<number> {
	if (ctx.noteSlugs.size === 0) {
		return 0;
	}
	await ensureFolder(app, `${ctx.exportFolder}/notes`);
	await ensureFolder(app, `${ctx.exportFolder}/assets`);
	const total = ctx.noteSlugs.size;
	let count = 0;
	for (const [path, slug] of ctx.noteSlugs) {
		const dbg: Record<string, unknown> = { path };
		ctx.debug.push(dbg);
		const f = app.vault.getFileByPath(path);
		let inner: string;
		let extraCss = "";
		if (f === null) {
			ctx.problems.push(`note-missing:${path}`);
			inner = `<div class="np-error"><h2>${t(locale, "errorTitle")}</h2><p>${escapeHtml(path)}</p></div>`;
		} else {
			try {
				const rendered = await renderNoteBody(app, owner, f, ctx, dbg, locale);
				inner = rendered.html;
				extraCss = rendered.extraCss;
			} catch (e) {
				ctx.problems.push(`note-render:${path}`);
				dbg.renderError = e instanceof Error ? e.message : String(e);
				const raw = await safeRead(app, f);
				inner =
					`<div class="np-error"><h2>${t(locale, "errorTitle")}</h2>` +
					`<p>${escapeHtml(String(e))}</p></div>` +
					`<pre class="np-raw">${escapeHtml(raw)}</pre>`;
			}
		}
		const basename = f?.basename ?? path;
		const bodyHtml =
			`<h1>${escapeHtml(basename)}</h1>` +
			`<div class="np-meta"><span>${t(locale, "sourceNote")}: ${escapeHtml(path)}</span></div>` +
			inner +
			footer(locale, manifest);
		ctx.searchIndex.push({
			t: basename,
			u: `notes/${slug}`,
			x: plainTextOf(inner),
		});
		await app.vault.create(
			`${ctx.exportFolder}/notes/${slug}`,
			buildPage({
				locale,
				title: basename,
				bodyHtml,
				extraCss,
				cssHrefs,
				chrome,
				pagePath: `notes/${slug}`,
				security: ctx.security,
			}),
		);
		count++;
		onProgress?.(count, total);
	}
	return count;
}

/**
 * Best-effort MathJax → SVG conversion using the app's own MathJax instance.
 * Every step is duck-typed and guarded; on any miss the CHTML stays and the
 * debug sidecar records why (empirical probe + fix in one).
 */
function convertMathToSvg(
	host: HTMLElement,
	dbg: Record<string, unknown>,
): void {
	const mj = (window as unknown as { MathJax?: Record<string, unknown> })
		.MathJax;
	const info: Record<string, unknown> = {
		mathJaxPresent: mj !== undefined,
		tex2svg: typeof (mj as { tex2svg?: unknown } | undefined)?.tex2svg,
		version: (mj as { version?: unknown } | undefined)?.version ?? null,
	};
	dbg.mathSvg = info;
	if (mj === undefined) {
		return;
	}
	const tex2svg = (
		mj as {
			tex2svg?: (tex: string, opts?: { display?: boolean }) => HTMLElement;
		}
	).tex2svg;
	if (typeof tex2svg !== "function") {
		// Which sources exist for a future attempt? Record key names only.
		info.mathJaxKeys = Object.keys(mj).slice(0, 30);
		return;
	}
	// Sources: MathJax v3 keeps MathItems on startup.document.math with the
	// original TeX and the typeset root element.
	const startupDoc = (
		mj as {
			startup?: { document?: { math?: Iterable<unknown> } };
		}
	).startup?.document;
	const items = startupDoc?.math;
	if (items === undefined) {
		info.noMathList = true;
		return;
	}
	let converted = 0;
	let failed = 0;
	for (const item of Array.from(items as Iterable<unknown>)) {
		try {
			const it = item as {
				math?: unknown;
				display?: unknown;
				typesetRoot?: unknown;
			};
			const root = it.typesetRoot;
			if (
				!(root instanceof HTMLElement) ||
				!host.contains(root) ||
				typeof it.math !== "string"
			) {
				continue;
			}
			const svgWrap = tex2svg(it.math, { display: it.display === true });
			const svg = svgWrap.querySelector("svg");
			if (svg === null) {
				failed++;
				continue;
			}
			const target =
				root.querySelector("mjx-container") ??
				(root.matches("mjx-container") ? root : root);
			const holder = document.createElement(
				it.display === true ? "div" : "span",
			);
			holder.className =
				it.display === true ? "np-math np-math-block" : "np-math";
			holder.appendChild(svg.cloneNode(true));
			target.replaceWith(holder);
			converted++;
		} catch {
			failed++;
		}
	}
	info.converted = converted;
	info.failed = failed;
}

/**
 * Collapsed foldable callouts render EMPTY in reading view (content is lazy).
 * Force-expand via a synthetic title click so the content materializes, then
 * restore the collapsed state for the exported page (2026-07-03 finding).
 */
async function expandCollapsedCallouts(
	host: HTMLElement,
	dbg: Record<string, unknown>,
): Promise<void> {
	const collapsed = Array.from(
		host.querySelectorAll(".callout.is-collapsible.is-collapsed"),
	);
	if (collapsed.length === 0) {
		return;
	}
	for (const co of collapsed) {
		const title = co.querySelector(".callout-title");
		if (title instanceof HTMLElement) {
			title.click();
		}
	}
	await sleep(200);
	for (const co of collapsed) {
		co.classList.add("is-collapsed");
	}
	dbg.calloutsForceExpanded = collapsed.length;
}

async function renderNoteBody(
	app: App,
	owner: Component,
	f: TFile,
	ctx: NoteExportCtx,
	dbg: Record<string, unknown>,
	locale: NpLocale,
): Promise<{ html: string; extraCss: string }> {
	const propsHtml = renderProperties(app, f, ctx, locale);
	const raw = await app.vault.cachedRead(f);
	const body = stripFrontmatter(raw);

	// Render in a hidden container ATTACHED to the document — the safe path
	// for Obsidian's renderer (detached rendering is unverified behavior).
	// A per-note child Component isolates this note's rendered views, so
	// embed→query-result matching never sees another note's leftovers, and
	// everything unloads when we're done.
	const host = document.createElement("div");
	host.style.position = "fixed";
	host.style.left = "-99999px";
	host.style.width = "800px";
	document.body.appendChild(host);
	const renderOwner = new Component();
	owner.addChild(renderOwner);
	try {
		await MarkdownRenderer.render(app, body, host, f.path, renderOwner);
		await sleep(50);
		// Base embeds render asynchronously; poll until every base embed has a
		// matched query result (big vaults need seconds, not a fixed delay).
		if (host.querySelector(".internal-embed") !== null) {
			await waitForEmbedResults(renderOwner, host, 10_000, dbg);
			probeBaseEmbeds(renderOwner, host, dbg);
			await replaceBaseEmbeds(app, renderOwner, host, f, ctx, dbg, locale);
		}
		await expandCollapsedCallouts(host, dbg);
		await postProcess(app, host, f, ctx, dbg, locale);
		makeHeadingsFoldable(host, dbg);
		// MathJax: CHTML output depends on app-local fonts and degrades badly
		// offline (2026-07-03 gauntlet). Try converting each formula to SVG
		// (self-contained glyphs) via the app's own MathJax; keep CHTML +
		// carried stylesheet as fallback when conversion is unavailable.
		let extraCss = "";
		if (host.querySelector("mjx-container") !== null) {
			convertMathToSvg(host, dbg);
			if (host.querySelector("mjx-container:not([data-np-svg])") !== null) {
				const parts: string[] = [];
				for (const s of Array.from(document.querySelectorAll("style"))) {
					const txt = s.textContent ?? "";
					if (txt.includes("mjx-")) {
						parts.push(txt);
					}
				}
				// app://-hosted MathJax fonts are unreachable offline (and leak
				// internal URLs) — drop those @font-face blocks; system-font
				// fallback already carries the glyphs.
				extraCss = parts
					.join("\n")
					.replace(/@font-face[^{]*\{[^}]*app:\/\/[^}]*\}/gu, "");
				dbg.mathCssBytes = extraCss.length;
			}
		}
		return {
			html: propsHtml + `<div class="np-note-content">${host.innerHTML}</div>`,
			extraCss,
		};
	} finally {
		owner.removeChild(renderOwner);
		renderOwner.unload();
		host.remove();
	}
}

/**
 * Phase 5 core: swap every base embed's raw DOM (app toolbar and all) for our
 * clean semantic table, built from the SAME engine-evaluated query result that
 * Obsidian rendered for this embed — `this` context and named-view selection
 * therefore match Obsidian by construction.
 *
 * Evidence (2026-07-02 probe): embed spans carry class `bases-embed`, and each
 * query result's owner has a containerEl INSIDE its own embed span — matching
 * by `span.contains(containerEl)` associates them one-to-one.
 * A base embed with no matched result becomes a loud error block, never blank.
 */
async function replaceBaseEmbeds(
	app: App,
	renderOwner: Component,
	host: HTMLElement,
	f: TFile,
	ctx: NoteExportCtx,
	dbg: Record<string, unknown>,
	locale: NpLocale,
): Promise<void> {
	// base embeds (![[x.base#View]]) AND fenced ```base blocks
	// (block-language-base is Obsidian's fenced-code container convention —
	// logged so a mismatch shows up in the sidecar instead of hiding).
	const embeds = Array.from(
		host.querySelectorAll(".internal-embed, .block-language-base"),
	);
	if (embeds.length === 0) {
		return;
	}
	const hits = findAllQueryResults(renderOwner, 16);
	const log: Array<Record<string, unknown>> = [];
	dbg.embedReplacements = log;
	for (const span of embeds) {
		const isFenced = span.classList.contains("block-language-base");
		const src = span.getAttribute("src") ?? "";
		const dest = isFenced
			? null
			: app.metadataCache.getFirstLinkpathDest(stripSubpath(src), f.path);
		const isBase =
			isFenced ||
			span.classList.contains("bases-embed") ||
			dest?.extension === "base" ||
			stripSubpath(src).endsWith(".base");
		if (!isBase) {
			log.push({ src, skipped: "not-a-base-embed" });
			continue;
		}
		const hit = hits.find((h) => {
			const el = (h.owner as { containerEl?: unknown } | null)?.containerEl;
			return el instanceof HTMLElement && span.contains(el);
		});
		if (hit === undefined) {
			ctx.problems.push(`embed-no-data:${f.path}:${src}`);
			const err = document.createElement("div");
			err.className = "np-error";
			const h2 = document.createElement("h2");
			h2.textContent = t(locale, "errorTitle");
			const p = document.createElement("p");
			p.textContent = `${src} — ${t(locale, "errorNoQueryData")}`;
			err.appendChild(h2);
			err.appendChild(p);
			span.replaceWith(err);
			log.push({ src, replaced: "error-block" });
			continue;
		}
		const runtimeType = ownerViewType(hit.owner);
		const coverMap =
			runtimeType === "cards"
				? await buildCoverMap(
						app,
						hit,
						f.path,
						ctx.exportFolder,
						ctx.assets,
						"../assets/",
					)
				: new Map<string, string>();
		// summaries for the embedded named view (parsed from the .base source)
		let summariesCfg: Record<string, string> | null = null;
		if (dest !== null && dest.extension === "base") {
			try {
				const hashIdx = src.indexOf("#");
				summariesCfg = viewSummariesFor(
					await app.vault.cachedRead(dest),
					hashIdx >= 0 ? src.slice(hashIdx + 1) : null,
				);
			} catch {
				summariesCfg = null;
			}
		}
		const hrefForNote = (p: string): string | null =>
			ctx.noteSlugs.get(p) ?? null;
		const resolveWikilink = (target: string): string | null => {
			const dest2 = app.metadataCache.getFirstLinkpathDest(
				stripSubpath(target),
				f.path,
			);
			return dest2 !== null ? hrefForNote(dest2.path) : null;
		};
		const table = renderSemanticView(
			hit,
			runtimeType,
			locale,
			ctx.problems,
			hrefForNote,
			(entry) => coverMap.get(entry.file?.path ?? "") ?? null,
			resolveWikilink,
			summariesCfg,
		);
		const wrap = document.createElement("div");
		wrap.className = "np-embedded-base";
		if (
			runtimeType !== null &&
			runtimeType !== "table" &&
			table.renderedAs !== runtimeType
		) {
			const banner = document.createElement("div");
			banner.className = "np-banner";
			banner.textContent = t(locale, "viewTypeFallback", {
				type: runtimeType,
			});
			wrap.appendChild(banner);
		}
		// Caption links back to the base's exported page (Notion-style database
		// title). Note pages live under notes/, base pages at the export root.
		const caption = document.createElement("div");
		caption.className = "np-embed-caption";
		if (
			dest !== null &&
			dest.extension === "base" &&
			ctx.basePages.has(dest.path)
		) {
			// deep-link straight to the named view's section on the base page
			// (base pages live beside note pages under notes/)
			const hashIdx = src.indexOf("#");
			const viewName = hashIdx >= 0 ? src.slice(hashIdx + 1) : "";
			const anchor =
				viewName !== ""
					? `#${encodeURI(viewAnchorId(viewName))}`
					: "";
			const a = document.createElement("a");
			a.className = "np-embed-caption-link";
			a.href = `${basePageFile(dest.path)}${anchor}`;
			a.textContent = src;
			caption.appendChild(a);
		} else {
			caption.textContent = src !== "" ? src : "```base";
		}
		wrap.appendChild(caption);
		const tableHost = document.createElement("div");
		tableHost.innerHTML = table.html;
		while (tableHost.firstChild !== null) {
			wrap.appendChild(tableHost.firstChild);
		}
		span.replaceWith(wrap);
		log.push({
			src,
			rows: table.rowCount,
			groups: table.groupCount,
			matchedPath: hit.path,
		});
	}
}

/**
 * Wrap each heading + its following content into nested .np-hsec sections so
 * the exported page can fold/unfold headings like Obsidian (default: open).
 * The renderer may wrap blocks in <div>s, so a "heading block" is either a
 * bare h1–h6 or a wrapper whose only element child is one. Top-level structure
 * is recorded in the debug sidecar as evidence.
 */
function makeHeadingsFoldable(
	root: HTMLElement,
	dbg: Record<string, unknown>,
): void {
	const children = Array.from(root.children);
	dbg.topLevelTags = children.map((c) => c.tagName.toLowerCase()).slice(0, 60);

	const headingOf = (el: Element): HTMLHeadingElement | null => {
		if (/^H[1-6]$/u.test(el.tagName)) {
			return el as HTMLHeadingElement;
		}
		const first = el.firstElementChild;
		if (
			first !== null &&
			/^H[1-6]$/u.test(first.tagName) &&
			el.children.length === 1
		) {
			return first as HTMLHeadingElement;
		}
		return null;
	};

	const stack: Array<{ level: number; body: HTMLElement }> = [];
	const target = (): HTMLElement =>
		stack.length > 0 ? stack[stack.length - 1].body : root;

	let sectionCount = 0;
	for (const child of children) {
		const h = headingOf(child);
		if (h === null) {
			target().appendChild(child);
			continue;
		}
		const level = Number(h.tagName.slice(1));
		while (stack.length > 0 && stack[stack.length - 1].level >= level) {
			stack.pop();
		}
		const sec = document.createElement("div");
		sec.className = "np-hsec";
		const body = document.createElement("div");
		body.className = "np-hsec-body";
		target().appendChild(sec);
		sec.appendChild(child);
		// fold arrow BEFORE the heading text (Obsidian / Notion style)
		const btn = document.createElement("span");
		btn.className = "np-fold-btn";
		btn.textContent = "▾";
		h.classList.add("np-hsec-heading");
		h.insertBefore(btn, h.firstChild);
		sec.appendChild(body);
		stack.push({ level, body });
		sectionCount++;
	}
	dbg.foldableSections = sectionCount;
}

/** Frontmatter properties as a Notion-ish key/value table. */
function renderProperties(
	app: App,
	f: TFile,
	ctx: NoteExportCtx,
	locale: NpLocale,
): string {
	const fm = app.metadataCache.getFileCache(f)?.frontmatter;
	if (!fm) {
		return "";
	}
	const rows = Object.entries(fm)
		.filter(([k]) => k !== "position")
		.map(
			([k, v]) =>
				`<tr><th>${escapeHtml(k)}</th><td>${propValueHtml(app, f, v, ctx, locale)}</td></tr>`,
		);
	if (rows.length === 0) {
		return "";
	}
	return `<table class="np-props">${rows.join("")}</table>`;
}

function propValueHtml(
	app: App,
	f: TFile,
	v: unknown,
	ctx: NoteExportCtx,
	locale: NpLocale,
): string {
	if (Array.isArray(v)) {
		return v
			.map(
				(item) =>
					`<span class="np-chip">${propScalarHtml(app, f, item, ctx, locale)}</span>`,
			)
			.join("");
	}
	return propScalarHtml(app, f, v, ctx, locale);
}

function propScalarHtml(
	app: App,
	f: TFile,
	v: unknown,
	ctx: NoteExportCtx,
	locale: NpLocale,
): string {
	if (v === null || v === undefined) {
		return "";
	}
	if (typeof v === "string") {
		const m = /^\[\[(.+?)(?:\|(.*?))?\]\]$/u.exec(v.trim());
		if (m !== null) {
			const target = m[1];
			const display = m[2] !== undefined && m[2] !== "" ? m[2] : target;
			const dest = app.metadataCache.getFirstLinkpathDest(
				stripSubpath(target),
				f.path,
			);
			const slug = dest !== null ? ctx.noteSlugs.get(dest.path) : undefined;
			if (slug !== undefined) {
				return `<a class="np-note-link" href="${escapeHtml(slug)}">${escapeHtml(display)}</a>`;
			}
			return `<span class="np-link-out" title="${escapeHtml(t(locale, "linkOutOfScope"))}">${escapeHtml(display)}</span>`;
		}
		return escapeHtml(v);
	}
	return escapeHtml(String(v));
}

/**
 * Offline post-processing of the rendered DOM:
 * - internal links → exported note pages; out-of-scope links become marked,
 *   non-clickable spans (visible, honest — refined further in phase 6);
 * - images resolved back to vault files, copied under assets/, src rewritten;
 * - leftover embed spans counted for the debug sidecar (phase 5/6 territory).
 */
async function postProcess(
	app: App,
	root: HTMLElement,
	f: TFile,
	ctx: NoteExportCtx,
	dbg: Record<string, unknown>,
	locale: NpLocale,
): Promise<void> {
	const anchors = Array.from(
		root.querySelectorAll<HTMLAnchorElement>("a.internal-link, a[data-href]"),
	);
	const linkLog: Array<Record<string, unknown>> = [];
	dbg.links = linkLog;
	for (const a of anchors) {
		const linktext =
			a.getAttribute("data-href") ?? a.getAttribute("href") ?? "";
		const dest = app.metadataCache.getFirstLinkpathDest(
			stripSubpath(linktext),
			f.path,
		);
		const slug = dest !== null ? ctx.noteSlugs.get(dest.path) : undefined;
		if (slug !== undefined) {
			a.setAttribute("href", slug);
			a.removeAttribute("data-href");
			a.removeAttribute("target");
			a.classList.add("np-note-link");
			linkLog.push({ linktext, to: dest?.path });
		} else {
			const span = document.createElement("span");
			span.className = "np-link-out";
			span.title = t(locale, "linkOutOfScope");
			span.textContent = a.textContent ?? linktext;
			a.replaceWith(span);
			linkLog.push({ linktext, outOfScope: true, dest: dest?.path ?? null });
		}
	}

	// obsidian://open deep links (real-use fixture, caught 2026-07-04): dead
	// for recipients AND they leak the vault name + full note path into a
	// shared package — same leak class as app://. Rendered as the same honest
	// out-of-scope marker used for unexported wikilinks (all modes).
	const obsAnchors = Array.from(
		root.querySelectorAll<HTMLAnchorElement>('a[href^="obsidian://"]'),
	);
	for (const a of obsAnchors) {
		const span = document.createElement("span");
		span.className = "np-link-out";
		span.title = t(locale, "linkOutOfScope");
		span.textContent = a.textContent ?? "";
		a.replaceWith(span);
	}
	if (obsAnchors.length > 0) {
		dbg.obsidianLinksStripped = obsAnchors.length;
	}

	const imgs = Array.from(root.querySelectorAll<HTMLImageElement>("img"));
	const imgLog: Array<Record<string, unknown>> = [];
	dbg.images = imgLog;
	for (const img of imgs) {
		const rec: Record<string, unknown> = {
			originalSrc: img.getAttribute("src"),
		};
		imgLog.push(rec);
		const tf = resolveImageFile(app, img, f);
		rec.resolvedPath = tf?.path ?? null;
		if (tf === null) {
			ctx.problems.push(`img-unresolved:${f.path}`);
			markBrokenImage(img, locale);
			continue;
		}
		const assetName = await copyAssetToExport(
			app,
			ctx.exportFolder,
			tf,
			ctx.assets,
		);
		if (assetName !== null) {
			img.setAttribute("src", `../assets/${encodeURI(assetName)}`);
			rec.asset = assetName;
		} else {
			rec.copyError = "copy-failed";
			ctx.problems.push(`img-copy:${tf.path}`);
			markBrokenImage(img, locale);
		}
	}

	dbg.embedSpanCount = root.querySelectorAll(".internal-embed").length;

	// External embeds (YouTube/Twitter iframes) → offline oEmbed cards.
	await replaceExternalEmbeds(
		app,
		root,
		{
			exportFolder: ctx.exportFolder,
			assets: ctx.assets,
			cache: ctx.oembedCache,
		},
		dbg,
		locale,
		"../assets/",
	);

	// Task checkboxes: frozen output (readers can't toggle) + Minimal-theme
	// extended states rendered from data-task (user req 2026-07-03).
	// 2026-07-04: the 22 known states render the user-picked Font Awesome
	// glyphs (inline svg, currentColor); unknown states keep the CSS fallback.
	for (const li of Array.from(root.querySelectorAll("li.task-list-item"))) {
		const input = li.querySelector("input.task-list-item-checkbox");
		const span = document.createElement("span");
		span.className = "np-check";
		const task = li.getAttribute("data-task") ?? " ";
		span.setAttribute("data-task", task);
		const svg = checkboxSvg(task === "" ? " " : task);
		if (svg !== null) {
			span.classList.add("np-check-fa");
			span.innerHTML = svg;
		}
		if (input !== null) {
			input.replaceWith(span);
		} else {
			li.insertBefore(span, li.firstChild);
		}
	}

	// Embedded NOTES (![[note]]): keep Obsidian-rendered inline content when it
	// exists, framed with a title link; empty/lazy embeds become a link stub.
	const noteEmbedLog: Array<Record<string, unknown>> = [];
	dbg.noteEmbeds = noteEmbedLog;
	for (const span of Array.from(
		root.querySelectorAll(".internal-embed:not(.bases-embed)"),
	)) {
		const src = span.getAttribute("src") ?? "";
		if (
			src === "" ||
			span.classList.contains("image-embed") ||
			span.classList.contains("media-embed")
		) {
			continue; // image/media wrappers are handled by the img pipeline
		}
		const dest = app.metadataCache.getFirstLinkpathDest(
			stripSubpath(src),
			f.path,
		);
		if (dest === null || dest.extension !== "md") {
			continue; // unknown embeds left as-is
		}
		const slug = ctx.noteSlugs.get(dest.path);
		const hasContent = (span.textContent ?? "").trim().length > 0;
		const frame = document.createElement("div");
		frame.className = "np-note-embed";
		const head = document.createElement("div");
		head.className = "np-embed-caption";
		if (slug !== undefined) {
			const a = document.createElement("a");
			a.className = "np-embed-caption-link";
			a.href = slug;
			a.textContent = dest.basename;
			head.appendChild(a);
		} else {
			const s = document.createElement("span");
			s.className = "np-link-out";
			s.title = t(locale, "linkOutOfScope");
			s.textContent = dest.basename;
			head.appendChild(s);
		}
		frame.appendChild(head);
		if (hasContent) {
			const body = document.createElement("div");
			body.className = "np-note-embed-body";
			while (span.firstChild !== null) {
				body.appendChild(span.firstChild);
			}
			frame.appendChild(body);
		}
		span.replaceWith(frame);
		noteEmbedLog.push({ src, inline: hasContent, linked: slug !== undefined });
	}

	// Leftover embed-wrapper spans keep a decorative src="<wikilink>" attr —
	// harmless to browsers but it leaks raw vault names into the package.
	// Strip AFTER the note-embed handler (order matters: 2026-07-03 bug).
	for (const span of Array.from(
		root.querySelectorAll(".internal-embed[src]"),
	)) {
		span.removeAttribute("src");
		span.removeAttribute("alt");
	}

	// Tags: in Obsidian they open a vault-wide tag search — meaningless (and
	// target=_blank) offline. Render as an inert tag chip for now; can link to
	// the search page once phase 8 lands.
	for (const a of Array.from(root.querySelectorAll("a.tag"))) {
		const chip = document.createElement("span");
		chip.className = "np-tag";
		chip.textContent = a.textContent ?? "";
		a.replaceWith(chip);
	}

	// In-page anchors (footnotes etc.): Obsidian adds target=_blank which pops
	// a new window — strip it so they jump within the page.
	for (const a of Array.from(root.querySelectorAll('a[href^="#"]'))) {
		a.removeAttribute("target");
		a.removeAttribute("rel");
	}

	// Code blocks: Obsidian injects interactive chrome (copy button etc.) that
	// is dead offline — strip any button inside <pre>, then add our own
	// offline-capable copy button (handled by the page's inline script).
	for (const btn of Array.from(root.querySelectorAll("pre button"))) {
		btn.remove();
	}
	for (const pre of Array.from(root.querySelectorAll("pre"))) {
		if (pre.querySelector("code") !== null) {
			const b = document.createElement("button");
			b.className = "np-copy";
			b.type = "button";
			b.setAttribute("aria-label", "copy");
			// lucide "copy" icon (ISC licensed), inlined — zero dependencies
			b.innerHTML =
				'<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
			pre.appendChild(b);
		}
	}
}

/** Poll until every base-embed span has a matched query result, or timeout. */
async function waitForEmbedResults(
	renderOwner: Component,
	host: HTMLElement,
	timeoutMs: number,
	dbg: Record<string, unknown>,
): Promise<void> {
	const spans = Array.from(host.querySelectorAll(".internal-embed")).filter(
		(s) =>
			s.classList.contains("bases-embed") ||
			(s.getAttribute("src") ?? "").includes(".base"),
	);
	if (spans.length === 0) {
		await sleep(250);
		return;
	}
	const deadline = Date.now() + timeoutMs;
	let waited = 0;
	for (;;) {
		const hits = findAllQueryResults(renderOwner, spans.length + 4);
		const matched = spans.filter((sp) =>
			hits.some((h) => {
				const el = (h.owner as { containerEl?: unknown } | null)
					?.containerEl;
				return el instanceof HTMLElement && sp.contains(el);
			}),
		).length;
		if (matched >= spans.length || Date.now() > deadline) {
			dbg.embedWaitMs = waited;
			dbg.embedMatched = matched;
			dbg.embedExpected = spans.length;
			return;
		}
		await sleep(250);
		waited += 250;
	}
}

/**
 * Phase-5 probe: after a note render, inspect what base embeds became.
 * Records (a) the first embed's DOM sample, (b) every query-result-shaped
 * object reachable from the render-owner component graph, with whether its
 * owner's container element sits inside this note's rendered DOM — the
 * association we need to place per-embed tables correctly.
 */
export function probeBaseEmbeds(
	owner: Component,
	host: HTMLElement,
	dbg: Record<string, unknown>,
): void {
	const embeds = Array.from(host.querySelectorAll(".internal-embed"));
	dbg.embedSrcs = embeds.map((e) => e.getAttribute("src")).slice(0, 10);
	if (embeds.length > 0) {
		dbg.firstEmbedDom = embeds[0].outerHTML.slice(0, 4000);
	}
	const hits = findAllQueryResults(owner, 8);
	dbg.embedQueryHits = hits.map((h) => {
		const ownerEl = (h.owner as { containerEl?: unknown } | null)?.containerEl;
		const el =
			typeof Node !== "undefined" && ownerEl instanceof HTMLElement
				? ownerEl
				: null;
		return {
			path: h.path,
			dataLen: h.q.data.length,
			properties: h.q.properties,
			ownerHasContainerEl: el !== null,
			containerInsideThisNote: el !== null ? host.contains(el) : false,
			containerClass: el?.className ?? null,
		};
	});
}

/**
 * Rendered <img> back to its vault file. Tries, in order: the wrapping
 * embed span's src attribute (the wikilink target), an app://-style absolute
 * src mapped through the vault base path, then the raw src as a link path.
 */
function resolveImageFile(
	app: App,
	img: HTMLImageElement,
	f: TFile,
): TFile | null {
	const embedSrc = img.closest(".internal-embed")?.getAttribute("src");
	if (embedSrc) {
		const dest = app.metadataCache.getFirstLinkpathDest(
			stripSubpath(embedSrc),
			f.path,
		);
		if (dest !== null) {
			return dest;
		}
	}
	const src = img.getAttribute("src") ?? "";
	if (src.startsWith("app://")) {
		try {
			const decoded = decodeURIComponent(src.split("?")[0]);
			const adapter = app.vault.adapter;
			if (adapter instanceof FileSystemAdapter) {
				const base = `${adapter.getBasePath()}/`;
				const i = decoded.indexOf(base);
				if (i >= 0) {
					return app.vault.getFileByPath(decoded.slice(i + base.length));
				}
			}
		} catch {
			/* fall through */
		}
	}
	if (src !== "" && !src.startsWith("http")) {
		return app.metadataCache.getFirstLinkpathDest(stripSubpath(src), f.path);
	}
	return null;
}

function markBrokenImage(img: HTMLImageElement, locale: NpLocale): void {
	const span = document.createElement("span");
	span.className = "np-link-out";
	span.textContent = `⚠ ${t(locale, "brokenImage")}: ${img.getAttribute("alt") ?? img.getAttribute("src") ?? "?"}`;
	img.replaceWith(span);
}

/** wikilink target minus #heading / #^block subpaths */
function stripSubpath(linktext: string): string {
	const hash = linktext.indexOf("#");
	return hash >= 0 ? linktext.slice(0, hash) : linktext;
}

function stripFrontmatter(raw: string): string {
	return raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/u, "");
}

async function safeRead(app: App, f: TFile): Promise<string> {
	try {
		return await app.vault.cachedRead(f);
	} catch (e) {
		return `(read failed: ${e instanceof Error ? e.message : String(e)})`;
	}
}

function sleep(ms: number): Promise<void> {
	return new Promise((r) => setTimeout(r, ms));
}

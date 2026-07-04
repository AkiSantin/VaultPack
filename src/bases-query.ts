import { NpLocale, t } from "./i18n";
import { escapeHtml } from "./html-page";

/**
 * Shared machinery for reading Obsidian's Bases query results and rendering
 * them as semantic tables — used by root .base exports AND (phase 5) by base
 * embeds inside notes.
 *
 * Evidence log (export-debug.json, 2026-07-02):
 * - the file view's own `.data` is the raw file TEXT; the real result lives on
 *   an inner BasesView (e.g. view._children[0]._children[5].data). Indexes are
 *   version-fragile → bounded graph search for the officially guaranteed SHAPE
 *   (data: BasesEntry[], properties: BasesPropertyId[]).
 * - `instanceof` against the module's exported classes does NOT match engine
 *   internals — never rely on it.
 */
export interface QueryResultLike {
	data: EntryLike[];
	properties: string[];
}
export interface EntryLike {
	file?: { path?: string; basename?: string };
	getValue(propertyId: string): CellValueLike | null;
}
export interface CellValueLike {
	toString(): string;
	isTruthy?: () => boolean;
}
export interface GroupLike {
	key?: CellValueLike | null;
	entries: EntryLike[];
	hasKey?: () => boolean;
}
export interface FoundResult {
	q: QueryResultLike;
	path: string;
	/** object owning the matched `.data` — per public API a BasesView, whose
	 * `.config` (BasesViewConfig) provides getDisplayName */
	owner: unknown;
}

/**
 * Missing values arrive as a null-value OBJECT whose toString() is "null".
 * Obsidian shows an empty cell. Duck rule: falsy AND stringifies to "null"
 * → empty. A real text "null" is a truthy string and survives.
 */
export function valueToText(v: CellValueLike): string {
	const s = v.toString();
	if (s === "null") {
		try {
			if (typeof v.isTruthy === "function" && !v.isTruthy()) {
				return "";
			}
		} catch {
			/* keep original text on isTruthy failure */
		}
	}
	return s;
}

export function looksLikeQueryResult(x: unknown): x is QueryResultLike {
	if (x === null || typeof x !== "object") {
		return false;
	}
	try {
		const o = x as { data?: unknown; properties?: unknown };
		if (!Array.isArray(o.data) || !Array.isArray(o.properties)) {
			return false;
		}
		const first = o.data[0] as EntryLike | undefined;
		return (
			o.data.length === 0 ||
			(typeof first === "object" && typeof first?.getValue === "function")
		);
	} catch {
		return false;
	}
}

/** Parent/global references that would explode the graph search — never enter. */
const SKIP_KEYS = new Set([
	"app",
	"workspace",
	"vault",
	"metadataCache",
	"fileManager",
	"plugin",
	"plugins",
	"leaf",
	"containerEl",
	"contentEl",
	"scope",
	"win",
	"doc",
]);

/** Bounded BFS for the first query-result-shaped object. */
export function findQueryResult(root: unknown): FoundResult | null {
	const all = findAllQueryResults(root, 1);
	return all.length > 0 ? all[0] : null;
}

/** Bounded BFS collecting up to `cap` query-result-shaped objects. */
export function findAllQueryResults(root: unknown, cap: number): FoundResult[] {
	const results: FoundResult[] = [];
	if (root === null || typeof root !== "object") {
		return results;
	}
	const visited = new Set<object>();
	const queue: Array<{
		o: object;
		path: string;
		depth: number;
		parent: unknown;
	}> = [{ o: root as object, path: "root", depth: 0, parent: null }];
	let scanned = 0;
	while (queue.length > 0 && scanned < 1200 && results.length < cap) {
		const item = queue.shift();
		if (!item) {
			break;
		}
		const { o, path, depth, parent } = item;
		if (visited.has(o)) {
			continue;
		}
		visited.add(o);
		scanned++;

		if (looksLikeQueryResult(o)) {
			results.push({ q: o as unknown as QueryResultLike, path, owner: parent });
			continue;
		}
		if (depth >= 5) {
			continue;
		}
		let names: string[] = [];
		try {
			names = Object.getOwnPropertyNames(o).slice(0, 60);
		} catch {
			continue;
		}
		for (const n of names) {
			if (SKIP_KEYS.has(n)) {
				continue;
			}
			let v: unknown;
			try {
				v = (o as Record<string, unknown>)[n];
			} catch {
				continue;
			}
			if (v === null || typeof v !== "object") {
				continue;
			}
			if (typeof Node !== "undefined" && v instanceof Node) {
				continue;
			}
			if (Array.isArray(v)) {
				if (n === "_children") {
					for (let i = 0; i < Math.min(v.length, 20); i++) {
						const c: unknown = v[i];
						if (c !== null && typeof c === "object") {
							queue.push({
								o: c as object,
								path: `${path}.${n}[${i}]`,
								depth: depth + 1,
								parent: o,
							});
						}
					}
				}
				continue;
			}
			queue.push({
				o: v as object,
				path: `${path}.${n}`,
				depth: depth + 1,
				parent: o,
			});
		}
	}
	return results;
}

/**
 * Column header: prefer the official display name from the owning BasesView's
 * config (real vaults rename e.g. formula.Hit → "Version"); fall back to the
 * property id without its type prefix.
 */
export function headerLabel(
	owner: unknown,
	pid: string,
): { label: string; source: "config" | "fallback" } {
	try {
		const cfg = (
			owner as { config?: { getDisplayName?: (p: string) => string } } | null
		)?.config;
		if (cfg && typeof cfg.getDisplayName === "function") {
			const s = cfg.getDisplayName(pid);
			if (typeof s === "string" && s.length > 0) {
				return { label: s, source: "config" };
			}
		}
	} catch {
		/* fall through to fallback */
	}
	const dot = pid.indexOf(".");
	return { label: dot >= 0 ? pid.slice(dot + 1) : pid, source: "fallback" };
}

/** groupedData getter, duck-validated (array of {entries[]}). */
export function getGroups(q: QueryResultLike): GroupLike[] | null {
	try {
		const g = (q as unknown as { groupedData?: unknown }).groupedData;
		if (
			Array.isArray(g) &&
			g.every(
				(x) =>
					x !== null &&
					typeof x === "object" &&
					Array.isArray((x as GroupLike).entries),
			)
		) {
			return g as GroupLike[];
		}
	} catch {
		/* no grouped data */
	}
	return null;
}

export function groupHasKey(g: GroupLike): boolean {
	try {
		if (typeof g.hasKey === "function") {
			return g.hasKey();
		}
	} catch {
		/* fall through */
	}
	return g.key !== undefined && g.key !== null;
}

export interface RenderedTable {
	html: string;
	rowCount: number;
	columnCount: number;
	groupCount: number;
	headerSources: Record<string, string>;
	entryPaths: string[];
	/** which renderer actually produced the output */
	renderedAs: "table" | "list" | "cards";
}

/** The runtime view type from the owning BasesView (official `type` field). */
export function ownerViewType(owner: unknown): string | null {
	try {
		const vt = (owner as { type?: unknown } | null)?.type;
		return typeof vt === "string" ? vt : null;
	} catch {
		return null;
	}
}

/** View-config value via the official BasesViewConfig.get, duck-guarded. */
export function configGet(owner: unknown, key: string): unknown {
	try {
		const cfg = (owner as { config?: { get?: (k: string) => unknown } } | null)
			?.config;
		if (cfg && typeof cfg.get === "function") {
			return cfg.get(key);
		}
	} catch {
		/* unavailable */
	}
	return undefined;
}

/**
 * Cell text with `[[wikilink]]` / `[[wikilink|alias]]` tokens converted into
 * real links (when the resolver returns an href) or marked out-of-scope spans
 * — real vaults keep lists of links in properties (2026-07-02 finding: raw
 * `[[X]], [[Y]]` text leaked into exported cells and group headers).
 */
function cellHtml(
	text: string,
	locale: NpLocale,
	resolveWikilink?: (target: string) => string | null,
): string {
	if (resolveWikilink === undefined || !text.includes("[[")) {
		return escapeHtml(text);
	}
	const re = /\[\[([^\]|]+?)(?:\|([^\]]*))?\]\]/gu;
	let out = "";
	let last = 0;
	for (let m = re.exec(text); m !== null; m = re.exec(text)) {
		out += escapeHtml(text.slice(last, m.index));
		const target = m[1].trim();
		const display = m[2] !== undefined && m[2] !== "" ? m[2] : target;
		const href = resolveWikilink(target);
		out +=
			href !== null
				? `<a class="np-note-link" href="${escapeHtml(href)}">${escapeHtml(display)}</a>`
				: `<span class="np-link-out" title="${escapeHtml(t(locale, "linkOutOfScope"))}">${escapeHtml(display)}</span>`;
		last = m.index + m[0].length;
	}
	out += escapeHtml(text.slice(last));
	return out;
}

/**
 * Render an engine-evaluated result in its view's own shape: table stays
 * table; list → bullet/numbered list; cards → grid. Unknown types render as
 * a table (caller shows a loud fallback banner).
 */
export function renderSemanticView(
	found: FoundResult,
	viewType: string | null,
	locale: NpLocale,
	problems: string[],
	hrefForNote: (path: string) => string | null,
	coverSrcFor?: (entry: EntryLike) => string | null,
	resolveWikilink?: (target: string) => string | null,
	summariesCfg?: Record<string, string> | null,
): RenderedTable {
	if (viewType === "list") {
		return renderSemanticList(
			found,
			locale,
			problems,
			hrefForNote,
			resolveWikilink,
		);
	}
	if (viewType === "cards") {
		return renderSemanticCards(
			found,
			locale,
			problems,
			hrefForNote,
			coverSrcFor,
			resolveWikilink,
		);
	}
	return renderSemanticTable(
		found,
		locale,
		problems,
		hrefForNote,
		resolveWikilink,
		summariesCfg,
	);
}

/**
 * Engine-evaluated query result → semantic HTML table (Notion-token styling).
 * `hrefForNote(path)` decides row links: a relative href, or null to render a
 * marked non-clickable span (target not in this export).
 */
export function renderSemanticTable(
	found: FoundResult,
	locale: NpLocale,
	problems: string[],
	hrefForNote: (path: string) => string | null,
	resolveWikilink?: (target: string) => string | null,
	summariesCfg?: Record<string, string> | null,
): RenderedTable {
	const { q, owner } = found;
	const propertyIds = q.properties;
	const headerSources: Record<string, string> = {};
	const labels = propertyIds.map((pid) => {
		const h = headerLabel(owner, pid);
		headerSources[pid] = h.source;
		return h.label;
	});
	const headHtml = labels.map((l) => `<th>${escapeHtml(l)}</th>`).join("");

	const entryPaths = new Set<string>();
	const rowHtml = (entry: EntryLike): string => {
		const notePath = entry.file?.path;
		if (notePath !== undefined) {
			entryPaths.add(notePath);
		}
		const cells = propertyIds.map((pid, i) => {
			// data-label feeds the mobile stacked-row layout (td::before)
			const dl = ` data-label="${escapeHtml(labels[i])}"`;
			try {
				const v = entry.getValue(pid);
				const text = v === null ? t(locale, "emptyCell") : valueToText(v);
				if (pid === "file.name" && notePath !== undefined) {
					const href = hrefForNote(notePath);
					if (href !== null) {
						return `<td${dl}><a class="np-note-link" href="${escapeHtml(href)}">${escapeHtml(text)}</a></td>`;
					}
					return `<td${dl}><span class="np-link-out" title="${escapeHtml(t(locale, "linkOutOfScope"))}">${escapeHtml(text)}</span></td>`;
				}
				return `<td${dl}>${cellHtml(text, locale, resolveWikilink)}</td>`;
			} catch (e) {
				problems.push(`cell-error:${entry.file?.path ?? "?"}:${pid}`);
				const msg = e instanceof Error ? e.message : String(e);
				return `<td${dl} class="np-error">⚠ ${escapeHtml(msg)}</td>`;
			}
		});
		return `<tr>${cells.join("")}</tr>`;
	};

	// Summaries (parsed view config + BasesQueryResult.getSummaryValue).
	// The internal view object does NOT expose `.controller` (2026-07-03
	// diagnostics) — pass it when present, else null: built-in summaries
	// (Average/Sum/…) are expected to work without it; failures surface as
	// visible ⚠ cells, never silently.
	const controller =
		(owner as { controller?: unknown } | null)?.controller ?? null;
	const canSummarize =
		summariesCfg !== undefined &&
		summariesCfg !== null &&
		typeof (q as unknown as { getSummaryValue?: unknown })
			.getSummaryValue === "function";
	const summaryRow = (entries: EntryLike[], cls: string): string => {
		if (!canSummarize || summariesCfg === undefined || summariesCfg === null) {
			return "";
		}
		const cells = propertyIds.map((pid, i) => {
			const key = summariesCfg[pid];
			const dl = ` data-label="${escapeHtml(labels[i])}"`;
			if (key === undefined) {
				return `<td${dl}></td>`;
			}
			try {
				const v = (
					q as unknown as {
						getSummaryValue: (
							c: unknown,
							e: EntryLike[],
							p: string,
							k: string,
						) => CellValueLike;
					}
				).getSummaryValue(controller, entries, pid, key);
				return `<td${dl}><span class="np-sum-label">${escapeHtml(key)}</span> ${escapeHtml(valueToText(v))}</td>`;
			} catch (e) {
				problems.push(`summary-error:${pid}:${key}`);
				return `<td${dl} class="np-error">⚠ ${escapeHtml(e instanceof Error ? e.message : String(e))}</td>`;
			}
		});
		return `<tr class="np-summary-row ${cls}">${cells.join("")}</tr>`;
	};

	const groups = getGroups(q);
	const isGrouped =
		groups !== null &&
		(groups.length > 1 || (groups.length === 1 && groupHasKey(groups[0])));

	let bodiesHtml: string;
	let groupCount = 0;
	if (isGrouped && groups !== null) {
		groupCount = groups.length;
		bodiesHtml = groups
			.map((g) => {
				let keyText = "";
				if (groupHasKey(g) && g.key) {
					try {
						keyText = valueToText(g.key);
					} catch {
						keyText = "";
					}
				}
				// Empty-key group label is provisional until compared with real
				// Obsidian output for a null group.
				const label = keyText !== "" ? keyText : t(locale, "ungrouped");
				const header =
					`<tr class="np-group-header">` +
					`<th colspan="${propertyIds.length}">${cellHtml(label, locale, resolveWikilink)}</th></tr>`;
				return `<tbody class="np-group">${header}\n${g.entries
					.map(rowHtml)
					.join("\n")}${summaryRow(g.entries, "np-group-summary")}</tbody>`;
			})
			.join("\n");
		bodiesHtml += `<tbody>${summaryRow(q.data, "np-total-summary")}</tbody>`;
	} else {
		bodiesHtml = `<tbody>\n${q.data.map(rowHtml).join("\n")}\n${summaryRow(q.data, "np-total-summary")}</tbody>`;
	}

	return {
		html:
			`<div class="np-table-wrap"><table class="np-table">` +
			`<thead><tr>${headHtml}</tr></thead>` +
			bodiesHtml +
			`</table></div>`,
		rowCount: q.data.length,
		columnCount: propertyIds.length,
		groupCount,
		headerSources,
		entryPaths: [...entryPaths],
		renderedAs: "table",
	};
}

/** Shared per-entry cell extraction for list/cards renderers. */
interface EntryView {
	primaryHtml: string;
	subHtml: string;
	notePath: string | undefined;
}

function entryView(
	entry: EntryLike,
	propertyIds: string[],
	owner: unknown,
	locale: NpLocale,
	problems: string[],
	hrefForNote: (path: string) => string | null,
	headerSources: Record<string, string>,
	resolveWikilink?: (target: string) => string | null,
): EntryView {
	const notePath = entry.file?.path;
	const parts: string[] = [];
	let primaryHtml = "";
	for (let i = 0; i < propertyIds.length; i++) {
		const pid = propertyIds[i];
		let text = "";
		try {
			const v = entry.getValue(pid);
			text = v === null ? t(locale, "emptyCell") : valueToText(v);
		} catch (e) {
			problems.push(`cell-error:${notePath ?? "?"}:${pid}`);
			text = `⚠ ${e instanceof Error ? e.message : String(e)}`;
		}
		const h = headerLabel(owner, pid);
		headerSources[pid] = h.source;
		if (i === 0) {
			if (pid === "file.name" && notePath !== undefined) {
				const href = hrefForNote(notePath);
				primaryHtml =
					href !== null
						? `<a class="np-note-link" href="${escapeHtml(href)}">${escapeHtml(text)}</a>`
						: `<span class="np-link-out" title="${escapeHtml(t(locale, "linkOutOfScope"))}">${escapeHtml(text)}</span>`;
			} else {
				primaryHtml = cellHtml(text, locale, resolveWikilink);
			}
			continue;
		}
		if (text !== "") {
			parts.push(
				`<span class="np-sub-prop"><span class="np-sub-label">${escapeHtml(h.label)}</span> ${cellHtml(text, locale, resolveWikilink)}</span>`,
			);
		}
	}
	return {
		primaryHtml,
		subHtml: parts.length > 0 ? `<div class="np-list-sub">${parts.join("")}</div>` : "",
		notePath,
	};
}

/** groups (or a single pseudo-group) for uniform list/cards rendering */
function groupsOrWhole(q: QueryResultLike): {
	grouped: boolean;
	groups: GroupLike[];
} {
	const groups = getGroups(q);
	const grouped =
		groups !== null &&
		(groups.length > 1 || (groups.length === 1 && groupHasKey(groups[0])));
	return {
		grouped,
		groups: grouped && groups !== null ? groups : [{ entries: q.data }],
	};
}

function groupLabelHtml(
	g: GroupLike,
	grouped: boolean,
	locale: NpLocale,
	resolveWikilink?: (target: string) => string | null,
): string {
	if (!grouped) {
		return "";
	}
	let keyText = "";
	if (groupHasKey(g) && g.key) {
		try {
			keyText = valueToText(g.key);
		} catch {
			keyText = "";
		}
	}
	const label = keyText !== "" ? keyText : t(locale, "ungrouped");
	return `<div class="np-group-label">${cellHtml(label, locale, resolveWikilink)}</div>`;
}

/** Obsidian "list" view → ul/ol (markers config: number → ol). */
export function renderSemanticList(
	found: FoundResult,
	locale: NpLocale,
	problems: string[],
	hrefForNote: (path: string) => string | null,
	resolveWikilink?: (target: string) => string | null,
): RenderedTable {
	const { q, owner } = found;
	const headerSources: Record<string, string> = {};
	const markers = configGet(owner, "markers");
	const tag = markers === "number" ? "ol" : "ul";
	const { grouped, groups } = groupsOrWhole(q);
	const entryPaths = new Set<string>();

	const blocks = groups.map((g) => {
		const items = g.entries
			.map((entry) => {
				const ev = entryView(
					entry,
					q.properties,
					owner,
					locale,
					problems,
					hrefForNote,
					headerSources,
					resolveWikilink,
				);
				if (ev.notePath !== undefined) {
					entryPaths.add(ev.notePath);
				}
				return `<li>${ev.primaryHtml}${ev.subHtml}</li>`;
			})
			.join("\n");
		return (
			groupLabelHtml(g, grouped, locale, resolveWikilink) +
			`<${tag} class="np-list">${items}</${tag}>`
		);
	});

	return {
		html: `<div class="np-list-view">${blocks.join("\n")}</div>`,
		rowCount: q.data.length,
		columnCount: q.properties.length,
		groupCount: grouped ? groups.length : 0,
		headerSources,
		entryPaths: [...entryPaths],
		renderedAs: "list",
	};
}

/**
 * Obsidian "cards" view → responsive grid of tiles with optional cover images
 * (view config `image: <propertyId>` — ground truth from an Obsidian-written
 * .base, 2026-07-02). Cover srcs are pre-resolved/copied by the caller.
 */
export function renderSemanticCards(
	found: FoundResult,
	locale: NpLocale,
	problems: string[],
	hrefForNote: (path: string) => string | null,
	coverSrcFor?: (entry: EntryLike) => string | null,
	resolveWikilink?: (target: string) => string | null,
): RenderedTable {
	const { q, owner } = found;
	const headerSources: Record<string, string> = {};
	const { grouped, groups } = groupsOrWhole(q);
	const entryPaths = new Set<string>();

	// real vaults set these per view (observed: imageAspectRatio: 1, cardSize: 400)
	const ratioRaw = configGet(owner, "imageAspectRatio");
	const ratio =
		typeof ratioRaw === "number" && Number.isFinite(ratioRaw) && ratioRaw > 0
			? ratioRaw
			: null;
	const coverStyle = ratio !== null ? ` style="aspect-ratio: ${ratio}"` : "";
	const sizeRaw = configGet(owner, "cardSize");
	const gridStyle =
		typeof sizeRaw === "number" && Number.isFinite(sizeRaw) && sizeRaw > 50
			? ` style="grid-template-columns: repeat(auto-fill, minmax(min(${Math.round(sizeRaw)}px, 100%), 1fr))"`
			: "";

	const blocks = groups.map((g) => {
		const cards = g.entries
			.map((entry) => {
				const ev = entryView(
					entry,
					q.properties,
					owner,
					locale,
					problems,
					hrefForNote,
					headerSources,
					resolveWikilink,
				);
				if (ev.notePath !== undefined) {
					entryPaths.add(ev.notePath);
				}
				const coverSrc = coverSrcFor !== undefined ? coverSrcFor(entry) : null;
				// cover links to the note too — bigger tap target (user req
				// 2026-07-04). Property links inside subHtml stay independent
				// anchors to THEIR targets (no nesting: only cover+title link
				// to the card's note).
				const coverHref =
					ev.notePath !== undefined ? hrefForNote(ev.notePath) : null;
				const coverImg =
					coverSrc !== null
						? `<img src="${escapeHtml(coverSrc)}" alt="" loading="lazy">`
						: "";
				const coverHtml =
					coverSrc !== null
						? coverHref !== null
							? `<a class="np-card-cover" href="${escapeHtml(coverHref)}"${coverStyle}>${coverImg}</a>`
							: `<div class="np-card-cover"${coverStyle}>${coverImg}</div>`
						: "";
				return (
					`<div class="np-card">${coverHtml}<div class="np-card-title">${ev.primaryHtml}</div>` +
					ev.subHtml +
					`</div>`
				);
			})
			.join("\n");
		return (
			groupLabelHtml(g, grouped, locale, resolveWikilink) +
			`<div class="np-cards"${gridStyle}>${cards}</div>`
		);
	});

	return {
		html: `<div class="np-cards-view">${blocks.join("\n")}</div>`,
		rowCount: q.data.length,
		columnCount: q.properties.length,
		groupCount: grouped ? groups.length : 0,
		headerSources,
		entryPaths: [...entryPaths],
		renderedAs: "cards",
	};
}

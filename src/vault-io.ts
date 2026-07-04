import { App, TFile, normalizePath } from "obsidian";
import {
	FoundResult,
	configGet,
	valueToText,
} from "./bases-query";
import { NpLocale } from "./i18n";
import { uiT } from "./ui-i18n";

/** anchor id for a named view section (also used by embed captions) */
export function viewAnchorId(viewName: string): string {
	return `view-${sanitizeFileName(viewName)}`;
}

/**
 * Packaging spec (REQUIREMENTS v1.10): filenames are opaque stable hashes —
 * URL/file-system stays pure ASCII, original names appear only as page TEXT.
 * FNV-1a over the vault path: deterministic across runs, no crypto dependency.
 */
export function fnv1aHex(s: string): string {
	let h = 0x811c9dc5;
	for (let i = 0; i < s.length; i++) {
		h ^= s.charCodeAt(i);
		h = Math.imul(h, 0x01000193);
	}
	return (h >>> 0).toString(16).padStart(8, "0");
}

export function notePageFile(vaultPath: string): string {
	return `note-${fnv1aHex(vaultPath)}.html`;
}
export function basePageFile(vaultPath: string): string {
	return `base-${fnv1aHex(vaultPath)}.html`;
}
export function assetFile(vaultPathOrUrl: string, ext: string): string {
	return `asset-${fnv1aHex(vaultPathOrUrl)}${ext !== "" ? `.${ext}` : ""}`;
}

export interface ViewSpec {
	name: string;
	type: string;
	/** view-level summaries config: propertyId → summary formula name
	 * (BasesConfigFileView.summaries per the official type surface;
	 * config.get() only exposes registration options — 2026-07-03 finding) */
	summaries: Record<string, string> | null;
}

/**
 * Structural discovery of a .base file's named views (name/type/summaries —
 * no expression evaluation; the engine still does all querying).
 */
export function extractViews(baseYaml: string): ViewSpec[] {
	const views: ViewSpec[] = [];
	let inViews = false;
	let inSummaries = false;
	let summariesIndent = 0;
	let current: ViewSpec | null = null;
	for (const line of baseYaml.split(/\r?\n/)) {
		if (/^views:\s*$/.test(line)) {
			inViews = true;
			continue;
		}
		if (inViews && /^\S/.test(line)) {
			break;
		}
		if (!inViews) {
			continue;
		}
		const typeMatch = /^\s*-\s+type:\s*(.+?)\s*$/.exec(line);
		if (typeMatch !== null) {
			current = { name: "", type: stripQuotes(typeMatch[1]), summaries: null };
			views.push(current);
			inSummaries = false;
			continue;
		}
		if (current === null) {
			continue;
		}
		const indent = (/^\s*/.exec(line)?.[0] ?? "").length;
		if (inSummaries) {
			const kv = /^\s+([^:\n]+):\s*(.+?)\s*$/.exec(line);
			if (kv !== null && indent > summariesIndent) {
				current.summaries = current.summaries ?? {};
				current.summaries[stripQuotes(kv[1].trim())] = stripQuotes(kv[2]);
				continue;
			}
			inSummaries = false;
		}
		if (/^\s+summaries:\s*$/.test(line)) {
			inSummaries = true;
			summariesIndent = indent;
			continue;
		}
		const nameMatch = /^\s{2,}name:\s*(.+?)\s*$/.exec(line);
		if (nameMatch !== null && current.name === "") {
			current.name = stripQuotes(nameMatch[1]);
		}
	}
	return views.filter((v) => v.name !== "");
}

/** summaries config for a named view (or the first view when unnamed). */
export function viewSummariesFor(
	baseYaml: string,
	viewName: string | null,
): Record<string, string> | null {
	const views = extractViews(baseYaml);
	if (views.length === 0) {
		return null;
	}
	const v =
		viewName !== null && viewName !== ""
			? views.find((x) => x.name === viewName)
			: views[0];
	return v?.summaries ?? null;
}

function stripQuotes(s: string): string {
	const m = /^["'](.*)["']$/.exec(s);
	return m !== null ? m[1] : s;
}

/** slug collision must fail LOUD before anything ships (spec rule). */
export class NameRegistry {
	private used = new Map<string, string>();
	constructor(private readonly locale: NpLocale = "en") {}
	claim(filename: string, sourceKey: string): void {
		const prev = this.used.get(filename);
		if (prev !== undefined && prev !== sourceKey) {
			throw new Error(
				uiT(this.locale, "errNameCollision", {
					file: filename,
					a: prev,
					b: sourceKey,
				}),
			);
		}
		this.used.set(filename, sourceKey);
	}
	entries(): Array<[string, string]> {
		return [...this.used.entries()];
	}
}

const IMAGE_EXTS = new Set([
	"png",
	"jpg",
	"jpeg",
	"gif",
	"webp",
	"svg",
	"avif",
	"bmp",
]);

/**
 * Copy a binary vault file into the export's assets/ folder exactly once
 * (dedup via the shared `assets` map: vault path → asset file name).
 * Names follow the packaging spec: asset-<stable-hash>.<ext> (pure ASCII).
 */
export async function copyAssetToExport(
	app: App,
	exportFolder: string,
	tf: TFile,
	assets: Map<string, string>,
): Promise<string | null> {
	const existing = assets.get(tf.path);
	if (existing !== undefined) {
		return existing;
	}
	await ensureFolder(app, `${exportFolder}/assets`);
	const name = assetFile(tf.path, tf.extension.toLowerCase());
	try {
		const data = await app.vault.readBinary(tf);
		await app.vault.createBinary(`${exportFolder}/assets/${name}`, data);
	} catch {
		return null;
	}
	assets.set(tf.path, name);
	return name;
}

/**
 * Cards cover images: the view config key is `image` with a property id
 * (ground truth 2026-07-02 — Obsidian UI wrote `image: note.cover` into the
 * .base). Pre-copies each entry's cover into assets/ and returns
 * entry-path → relative img src for the renderer.
 */
export async function buildCoverMap(
	app: App,
	found: FoundResult,
	sourcePath: string,
	exportFolder: string,
	assets: Map<string, string>,
	srcPrefix: string,
): Promise<Map<string, string>> {
	const map = new Map<string, string>();
	const pid = configGet(found.owner, "image");
	if (typeof pid !== "string" || pid === "") {
		return map;
	}
	for (const entry of found.q.data) {
		const notePath = entry.file?.path;
		if (notePath === undefined) {
			continue;
		}
		let text = "";
		try {
			const v = entry.getValue(pid);
			text = v === null ? "" : valueToText(v);
		} catch {
			continue;
		}
		text = text.trim();
		if (text === "") {
			continue;
		}
		const m = /^!?\[\[(.+?)(?:\|.*)?\]\]$/u.exec(text);
		const target = m !== null ? m[1] : text;
		if (/^https?:\/\//u.test(target)) {
			map.set(notePath, target);
			continue;
		}
		const hash = target.indexOf("#");
		const linkpath = hash >= 0 ? target.slice(0, hash) : target;
		const dest = app.metadataCache.getFirstLinkpathDest(linkpath, sourcePath);
		if (dest === null || !IMAGE_EXTS.has(dest.extension.toLowerCase())) {
			continue;
		}
		const name = await copyAssetToExport(app, exportFolder, dest, assets);
		if (name !== null) {
			map.set(notePath, `${srcPrefix}${encodeURI(name)}`);
		}
	}
	return map;
}

/** Flatten path separators and characters unsafe in file names / URLs. */
export function sanitizeFileName(name: string): string {
	return name.replace(/[\\/:*?"<>|#^[\]]/g, "-");
}

/**
 * Note-page file name from the vault path (extension dropped, separators and
 * unsafe characters flattened). Collision-proof URL mapping is a phase-6 job.
 */
export function slugForNotePath(path: string): string {
	return sanitizeFileName(path.replace(/\.md$/u, ""));
}

/** `YYYYMMDD-HHMMSS` from the real local clock. */
export function timestampToken(d: Date): string {
	const p = (n: number, w = 2) => String(n).padStart(w, "0");
	return (
		`${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}` +
		`-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
	);
}

export async function ensureFolder(app: App, path: string): Promise<void> {
	if (!(await app.vault.adapter.exists(path))) {
		await app.vault.createFolder(path);
	}
}

/**
 * Create a brand-new export folder under "VaultPack Exports".
 * Default name = <prefix>-<timestamp>; web modes pass exactName instead
 * (high-entropy vaultpack-s-<token> / vaultpack-p-<token>, spec §3.1).
 * Refuses to reuse an existing path — no overwrite, ever.
 */
/** every package lands under this vault folder — and everything beneath it
 * is excluded from scopes/trees (exports must never re-export exports) */
export const EXPORTS_ROOT = "VaultPack Exports";

export async function createNewExportFolder(
	app: App,
	prefix: string,
	exactName?: string,
	locale: NpLocale = "en",
): Promise<string> {
	const root = normalizePath(EXPORTS_ROOT);
	await ensureFolder(app, root);
	const folder = normalizePath(
		`VaultPack Exports/${exactName ?? `${prefix}-${timestampToken(new Date())}`}`,
	);
	if (await app.vault.adapter.exists(folder)) {
		throw new Error(uiT(locale, "errFolderExists", { path: folder }));
	}
	await app.vault.createFolder(folder);
	return folder;
}

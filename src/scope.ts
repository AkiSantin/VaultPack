import { App, FuzzySuggestModal, TFile, TFolder } from "obsidian";
import { resolveLocale } from "./i18n";
import { UiKey, uiT } from "./ui-i18n";
import { EXPORTS_ROOT } from "./vault-io";

/** Export scope selection (REQUIREMENTS 硬需求 5：範圍自選). */
export type ExportScope =
	| { kind: "all-bases" }
	| { kind: "vault" }
	| { kind: "active-note" }
	| { kind: "folder"; folder: TFolder }
	| { kind: "base"; base: TFile };

interface ScopeChoice {
	id: "all-bases" | "vault" | "active-note" | "folder" | "base";
	labelKey: UiKey;
}

export class ScopePickerModal extends FuzzySuggestModal<ScopeChoice> {
	private readonly locale = resolveLocale();
	constructor(
		app: App,
		private readonly onPick: (scope: ExportScope | null) => void,
	) {
		super(app);
		this.setPlaceholder(uiT(this.locale, "scopePickerPlaceholder"));
	}
	getItems(): ScopeChoice[] {
		return [
			{ id: "all-bases", labelKey: "scopeAllBases" },
			{ id: "vault", labelKey: "scopeVault" },
			{ id: "folder", labelKey: "scopeFolder" },
			{ id: "base", labelKey: "scopeBase" },
			{ id: "active-note", labelKey: "scopeActiveNote" },
		];
	}
	getItemText(item: ScopeChoice): string {
		return uiT(this.locale, item.labelKey);
	}
	onChooseItem(item: ScopeChoice): void {
		if (item.id === "folder") {
			new FolderPickerModal(this.app, (f) =>
				this.onPick(f !== null ? { kind: "folder", folder: f } : null),
			).open();
			return;
		}
		if (item.id === "base") {
			new BasePickerModal(this.app, (b) =>
				this.onPick(b !== null ? { kind: "base", base: b } : null),
			).open();
			return;
		}
		this.onPick({ kind: item.id });
	}
}

class FolderPickerModal extends FuzzySuggestModal<TFolder> {
	private readonly locale = resolveLocale();
	constructor(
		app: App,
		private readonly onPick: (folder: TFolder | null) => void,
	) {
		super(app);
		this.setPlaceholder(uiT(this.locale, "folderPickerPlaceholder"));
	}
	getItems(): TFolder[] {
		const out: TFolder[] = [];
		const walk = (f: TFolder): void => {
			out.push(f);
			for (const c of f.children) {
				if (c instanceof TFolder) {
					walk(c);
				}
			}
		};
		walk(this.app.vault.getRoot());
		return out;
	}
	getItemText(item: TFolder): string {
		return item.path === "/" ? uiT(this.locale, "vaultRootLabel") : item.path;
	}
	onChooseItem(item: TFolder): void {
		this.onPick(item);
	}
}

class BasePickerModal extends FuzzySuggestModal<TFile> {
	private readonly locale = resolveLocale();
	constructor(
		app: App,
		private readonly onPick: (base: TFile | null) => void,
	) {
		super(app);
		this.setPlaceholder(uiT(this.locale, "basePickerPlaceholder"));
	}
	getItems(): TFile[] {
		return this.app.vault
			.getFiles()
			.filter((f) => f.extension === "base")
			.sort((a, b) => a.path.localeCompare(b.path));
	}
	getItemText(item: TFile): string {
		return item.path;
	}
	onChooseItem(item: TFile): void {
		this.onPick(item);
	}
}

/** md files under a folder (folder itself included; root = whole vault).
 * Anything inside the exports root is excluded — no re-exporting exports. */
export function notesUnderFolder(app: App, folder: TFolder): TFile[] {
	const prefix = folder.path === "/" ? "" : `${folder.path}/`;
	return app.vault
		.getMarkdownFiles()
		.filter(
			(f) =>
				f.path.startsWith(prefix) &&
				!f.path.startsWith(`${EXPORTS_ROOT}/`),
		)
		.sort((a, b) => a.path.localeCompare(b.path));
}

/** .base files under a folder. */
export function basesUnderFolder(app: App, folder: TFolder): TFile[] {
	const prefix = folder.path === "/" ? "" : `${folder.path}/`;
	return app.vault
		.getFiles()
		.filter((f) => f.extension === "base" && f.path.startsWith(prefix))
		.sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * Bases EMBEDDED by the given notes (![[x.base#View]]), wherever they live.
 * Real-use pattern: shared .base files sit in a central folder while notes
 * embed them — a folder export must follow those references or its packages
 * never contain base pages (user report 2026-07-04).
 */
export function basesEmbeddedInNotes(app: App, notes: TFile[]): TFile[] {
	const out = new Map<string, TFile>();
	for (const f of notes) {
		const embeds = app.metadataCache.getFileCache(f)?.embeds ?? [];
		for (const e of embeds) {
			const hash = e.link.indexOf("#");
			const linkpath = hash >= 0 ? e.link.slice(0, hash) : e.link;
			const dest = app.metadataCache.getFirstLinkpathDest(linkpath, f.path);
			if (dest !== null && dest.extension === "base") {
				out.set(dest.path, dest);
			}
		}
	}
	return [...out.values()].sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * The vault's FIXED attachment folder (Obsidian setting), when set that way.
 * getConfig is not in the public typings — duck-checked per project rule.
 * "/" (vault root) and "./xxx" (per-note subfolder) styles return null:
 * excluding those would be wrong/ambiguous, so the tree leaves them alone.
 */
function fixedAttachmentFolder(app: App): string | null {
	const get = (
		app.vault as unknown as { getConfig?: (k: string) => unknown }
	).getConfig;
	if (typeof get !== "function") {
		return null;
	}
	const v = get.call(app.vault, "attachmentFolderPath");
	if (
		typeof v !== "string" ||
		v === "" ||
		v === "/" ||
		v.startsWith("./") ||
		v === "."
	) {
		return null;
	}
	return v.replace(/\/+$/u, "");
}

/** every descendant folder path under `folder` (itself included unless root)
 * — the sidebar tree mirrors the REAL folder structure like Obsidian's
 * explorer, empty folders included (user req 2026-07-04). The exports root
 * and the vault's fixed attachment folder are excluded (sidebar-only:
 * in-content attachments are a separate pipeline and stay untouched). */
export function foldersUnder(app: App, folder: TFolder): string[] {
	const attach = fixedAttachmentFolder(app);
	const out: string[] = [];
	const walk = (f: TFolder): void => {
		// exports never re-export exports (a vault-scope tree would otherwise
		// drown in dozens of vaultpack-* package folders)
		if (f.path === EXPORTS_ROOT) {
			return;
		}
		// attachment folder: readers can't open anything there — pure noise
		if (attach !== null && f.path === attach) {
			return;
		}
		if (f.path !== "/") {
			out.push(f.path);
		}
		for (const c of f.children) {
			if (c instanceof TFolder) {
				walk(c);
			}
		}
	};
	walk(folder);
	return out.sort((a, b) => a.localeCompare(b));
}

/** merge base lists without duplicates (path identity), sorted. */
export function mergeBases(...lists: TFile[][]): TFile[] {
	const out = new Map<string, TFile>();
	for (const list of lists) {
		for (const f of list) {
			out.set(f.path, f);
		}
	}
	return [...out.values()].sort((a, b) => a.path.localeCompare(b.path));
}

import { App, Plugin, getLanguage } from "obsidian";
import { createNewExportFolder } from "./vault-io";

/** Obsidian desktop runs on Electron; `require` exists at runtime (isDesktopOnly). */
declare const require: (mod: string) => unknown;

/**
 * Phase-1 pre-step: probe, inside the real Obsidian runtime, everything we must
 * NOT assume about Bases:
 *  - which Bases-related symbols the runtime's "obsidian" module actually exports;
 *  - what the app language setting returns;
 *  - what view type / DOM Obsidian produces when a .base file is opened in a
 *    background tab, how long it takes to become non-empty, which CSS class
 *    names appear, and what the view object exposes (shallow key names only).
 * The findings are written to a JSON report; the exporter design follows the
 * report, not guesses.
 */
export async function runBasesProbe(app: App, plugin: Plugin): Promise<string> {
	const report: Record<string, unknown> = {
		probedAt: new Date().toISOString(),
		pluginVersion: plugin.manifest.version,
	};

	// A. runtime module surface
	try {
		const ob = require("obsidian") as Record<string, unknown>;
		report.basesRelatedExports = Object.keys(ob)
			.filter((k) => /bases|query|value/i.test(k))
			.sort();
	} catch (e) {
		report.basesRelatedExports = `require("obsidian") failed: ${String(e)}`;
	}
	report.appLanguage =
		typeof getLanguage === "function" ? getLanguage() : "getLanguage missing";
	report.registerBasesViewType = typeof (
		plugin as unknown as Record<string, unknown>
	).registerBasesView;

	// B. open the fixture .base in a background tab and watch what happens
	const baseFile = app.vault.getFiles().find((f) => f.extension === "base");
	if (!baseFile) {
		report.baseFile = null;
		report.note = "vault 內找不到 .base 檔，DOM 探測跳過";
	} else {
		report.baseFile = baseFile.path;
		report.baseSource = await app.vault.read(baseFile);
		const leaf = app.workspace.getLeaf("tab");
		try {
			await leaf.openFile(baseFile, { active: false });
			const samples: Array<Record<string, unknown>> = [];
			for (let i = 0; i < 16; i++) {
				await sleep(500);
				samples.push(sampleLeafDom(leaf.view.containerEl, i));
				const rows = samples[samples.length - 1].candidateCounts as Record<
					string,
					number
				>;
				const anyRows = Object.values(rows).some((n) => n > 0);
				if (anyRows && samples.length >= 4) break;
			}
			report.viewType = leaf.view.getViewType();
			report.viewConstructor = leaf.view.constructor?.name ?? "unknown";
			report.viewShallowKeys = shallowKeys(leaf.view, 3);
			report.samples = samples;
			report.basesClassTokens = collectClassTokens(
				leaf.view.containerEl,
				/bases/i,
				150,
			);
			report.domSample = leaf.view.containerEl.outerHTML.slice(0, 8000);
		} catch (e) {
			report.domProbeError = e instanceof Error ? e.message : String(e);
		} finally {
			leaf.detach();
		}
	}

	const folder = await createNewExportFolder(app, "probe-bases");
	const path = `${folder}/report.json`;
	await app.vault.create(path, JSON.stringify(report, null, 2));
	return path;
}

function sleep(ms: number): Promise<void> {
	return new Promise((r) => window.setTimeout(r, ms));
}

/** One timing sample: how much DOM exists, per a set of candidate row selectors. */
function sampleLeafDom(
	containerEl: HTMLElement,
	index: number,
): Record<string, unknown> {
	const candidates = [
		".bases-tr",
		"tr",
		'[role="row"]',
		'[class*="bases-row"]',
		'[class*="bases"]',
	];
	const counts: Record<string, number> = {};
	for (const sel of candidates) {
		try {
			counts[sel] = containerEl.querySelectorAll(sel).length;
		} catch {
			counts[sel] = -1;
		}
	}
	return {
		sampleIndex: index,
		htmlLength: containerEl.innerHTML.length,
		textLength: (containerEl.textContent ?? "").length,
		candidateCounts: counts,
	};
}

/** Own + inherited property NAMES (no values) up to `depth` prototype levels. */
function shallowKeys(obj: unknown, depth: number): string[] {
	const names = new Set<string>();
	let cur: unknown = obj;
	for (let i = 0; i < depth && cur != null && cur !== Object.prototype; i++) {
		for (const n of Object.getOwnPropertyNames(cur)) {
			names.add(n);
		}
		cur = Object.getPrototypeOf(cur);
	}
	return [...names].sort().slice(0, 250);
}

/** Distinct class tokens matching `pattern` anywhere under `root` (capped). */
function collectClassTokens(
	root: HTMLElement,
	pattern: RegExp,
	cap: number,
): string[] {
	const tokens = new Set<string>();
	const all = root.querySelectorAll("*");
	const limit = Math.min(all.length, 4000);
	for (let i = 0; i < limit && tokens.size < cap; i++) {
		const el = all[i];
		el.classList.forEach((t) => {
			if (pattern.test(t)) {
				tokens.add(t);
			}
		});
	}
	return [...tokens].sort();
}

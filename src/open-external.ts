import { App, FileSystemAdapter } from "obsidian";

/** Obsidian desktop runs on Electron; `require` exists at runtime (isDesktopOnly). */
declare const require: (mod: string) => unknown;

export function resolveAbsolutePath(
	app: App,
	vaultRelPath: string,
): string | null {
	const adapter = app.vault.adapter;
	if (adapter instanceof FileSystemAdapter) {
		return `${adapter.getBasePath()}/${vaultRelPath}`;
	}
	return null;
}

/**
 * Try, in order, the known ways to open a file with the default app.
 * Each attempt is logged; failure of all attempts is NOT an export failure —
 * the caller reports the path so the user can open it manually.
 * (openWithDefaultApp is not in the public API — probed defensively on purpose.)
 */
export async function tryOpenInBrowser(
	app: App,
	vaultRelPath: string,
	absolutePath: string | null,
): Promise<string | null> {
	const anyApp = app as unknown as {
		openWithDefaultApp?: (path: string) => unknown;
	};
	if (typeof anyApp.openWithDefaultApp === "function") {
		try {
			await anyApp.openWithDefaultApp(vaultRelPath);
			return "app.openWithDefaultApp";
		} catch (e) {
			console.warn("[VaultPack] openWithDefaultApp failed", e);
		}
	}
	if (absolutePath !== null) {
		try {
			const electron = require("electron") as {
				shell?: { openPath?: (p: string) => Promise<string> };
			};
			const openPath = electron.shell?.openPath;
			if (typeof openPath === "function") {
				const err = await openPath(absolutePath);
				if (err === "") {
					return "electron.shell.openPath";
				}
				console.warn("[VaultPack] shell.openPath returned error:", err);
			}
		} catch (e) {
			console.warn("[VaultPack] electron shell open failed", e);
		}
	}
	return null;
}

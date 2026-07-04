import { App, normalizePath } from "obsidian";
import {
	BlobWriter,
	Uint8ArrayReader,
	ZipWriter,
	configure,
} from "@zip.js/zip.js";
import { NpLocale } from "./i18n";
import { uiT } from "./ui-i18n";

/**
 * Encrypted ZIP export (spec §2.1): AES-256 (zip.js WebCrypto), NEVER legacy
 * ZipCrypto — spec forbids it. Compatibility note for the user is mandatory:
 * OS built-in extractors (macOS Archive Utility, Windows Explorer) do not
 * open AES ZIPs; The Unarchiver / Keka / 7-Zip do.
 *
 * Runs fully in-process (no workers: predictable inside the plugin sandbox,
 * no CSP surprises). The output package itself stays zero-dependency.
 */
export async function createEncryptedZip(
	app: App,
	exportFolder: string,
	password: string,
	locale: NpLocale = "en",
	onProgress?: (done: number, total: number) => void,
): Promise<{ zipPath: string; fileCount: number }> {
	configure({ useWebWorkers: false });
	const adapter = app.vault.adapter;

	// collect every file under the export folder (vault-relative paths)
	const files: string[] = [];
	const walk = async (folder: string): Promise<void> => {
		const listing = await adapter.list(folder);
		for (const f of listing.files) {
			files.push(f);
		}
		for (const d of listing.folders) {
			await walk(d);
		}
	};
	await walk(exportFolder);
	if (files.length === 0) {
		throw new Error(uiT(locale, "errZipEmpty", { path: exportFolder }));
	}

	// entries live under the folder's basename → extraction yields ONE folder
	const rootName = exportFolder.split("/").pop() ?? "vaultpack";
	const writer = new ZipWriter(new BlobWriter("application/zip"), {
		password,
		encryptionStrength: 3, // AES-256
		bufferedWrite: true,
	});
	let done = 0;
	for (const f of files.sort()) {
		const data = new Uint8Array(await adapter.readBinary(f));
		const rel = f.slice(exportFolder.length + 1);
		await writer.add(`${rootName}/${rel}`, new Uint8ArrayReader(data));
		done++;
		onProgress?.(done, files.length);
	}
	const blob = await writer.close();

	// brand-new .zip beside the folder — createBinary loud-fails on collision
	const zipPath = normalizePath(`${exportFolder}.zip`);
	if (await adapter.exists(zipPath)) {
		throw new Error(uiT(locale, "errZipExists", { path: zipPath }));
	}
	await app.vault.createBinary(zipPath, await blob.arrayBuffer());
	return { zipPath, fileCount: files.length };
}

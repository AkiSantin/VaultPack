/**
 * Verify a REAL encrypted export archive: list entries, extract START_HERE,
 * confirm wrong password is rejected. Usage: node zip-verify.mjs <zip> <pw>
 */
import { readFileSync } from "node:fs";
import {
	BlobReader,
	TextWriter,
	ZipReader,
	configure,
} from "@zip.js/zip.js";

configure({ useWebWorkers: false });
const [zipPath, password] = [process.argv[2], process.argv[3]];
const buf = readFileSync(zipPath);

const reader = new ZipReader(new BlobReader(new Blob([buf])), { password });
const entries = await reader.getEntries();
console.log(`entries=${entries.length}`);
const start = entries.find((e) => e.filename.endsWith("START_HERE.html"));
if (!start) {
	console.log("START_HERE=MISSING (FAIL)");
	process.exit(1);
}
const html = await start.getData(new TextWriter());
console.log(
	`START_HERE extracted, bytes=${html.length}, looksHtml=${html.startsWith("<!DOCTYPE html>") ? "OK" : "FAIL"}`,
);
await reader.close();

try {
	const bad = new ZipReader(new BlobReader(new Blob([buf])), {
		password: "definitely-wrong",
	});
	const e2 = await bad.getEntries();
	const target = e2.find((x) => x.filename.endsWith("START_HERE.html")) ?? e2[0];
	await target.getData(new TextWriter());
	console.log("wrongpw=NOT-REJECTED (FAIL)");
	process.exit(1);
} catch {
	console.log("wrongpw=rejected OK");
}

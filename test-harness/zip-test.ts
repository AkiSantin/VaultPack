/**
 * AES-ZIP pre-flight: same zip.js options as src/zip-aes.ts. Asserts the
 * archive is AES (method 99, encrypted flag), round-trips with the right
 * password, and rejects a wrong one. Usage: node zip-test.mjs <outZip>
 */
import { writeFileSync } from "node:fs";
import {
	BlobReader,
	BlobWriter,
	TextReader,
	TextWriter,
	ZipReader,
	ZipWriter,
	configure,
} from "@zip.js/zip.js";

configure({ useWebWorkers: false });
const out = process.argv[2];
const password = "vaultpack-test";

const writer = new ZipWriter(new BlobWriter("application/zip"), {
	password,
	encryptionStrength: 3,
	bufferedWrite: true,
});
await writer.add("pack/hello.txt", new TextReader("AES-CONTENT-MARKER"));
const blob = await writer.close();
const buf = Buffer.from(await blob.arrayBuffer());
writeFileSync(out, buf);

// local file header: method @8 (99 = AES), general-purpose flag bit0 @6
const method = buf.readUInt16LE(8);
const encrypted = (buf.readUInt16LE(6) & 1) === 1;
console.log(`method=${method} encrypted=${encrypted}`);

const reader = new ZipReader(new BlobReader(new Blob([buf])), { password });
const entries = await reader.getEntries();
const text = await entries[0].getData(new TextWriter());
console.log(`roundtrip=${text === "AES-CONTENT-MARKER" ? "OK" : "FAIL"}`);
await reader.close();

try {
	const bad = new ZipReader(new BlobReader(new Blob([buf])), {
		password: "wrong-password",
	});
	const e2 = await bad.getEntries();
	await e2[0].getData(new TextWriter());
	console.log("wrongpw=NOT-REJECTED (FAIL)");
} catch {
	console.log("wrongpw=rejected OK");
}

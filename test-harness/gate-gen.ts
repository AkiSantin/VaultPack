/**
 * Headless generator for the PHP gate self-test: writes the exact files the
 * plugin would emit in password mode into a docroot for `php -S` testing.
 * Usage: node gate-gen.mjs <outDir> <password>
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { buildPhpGate, hashPassword } from "../src/php-gate";
import { privateDenyHtaccess } from "../src/web-security";

const outDir = process.argv[2];
const password = process.argv[3];
if (!outDir || !password) {
	console.error("usage: gate-gen <outDir> <password>");
	process.exit(2);
}
const priv = "_np_private_TESTTOKEN123";
const hash = hashPassword(password);
const gate = buildPhpGate({
	privateSubdir: priv,
	passwordHash: hash,
	locale: "zh-TW",
	version: "0.16.0-selftest",
});
mkdirSync(`${outDir}/${priv}/notes`, { recursive: true });
writeFileSync(`${outDir}/index.php`, gate.indexPhp);
writeFileSync(`${outDir}/logout.php`, gate.logoutPhp);
writeFileSync(`${outDir}/${priv}/.htaccess`, privateDenyHtaccess());
writeFileSync(`${outDir}/${priv}/${gate.probeName}`, gate.probeContent);
writeFileSync(
	`${outDir}/${priv}/START_HERE.html`,
	'<!DOCTYPE html><html><head><meta charset="utf-8"><title>t</title></head>' +
		'<body><h1>SECRET-CONTENT-MARKER</h1><a href="notes/x.html">n</a></body></html>',
);
writeFileSync(
	`${outDir}/${priv}/notes/x.html`,
	"<!DOCTYPE html><html><body>NOTE-MARKER</body></html>",
);
console.log(`hash=${hash}`);

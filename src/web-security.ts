import { ModePlan } from "./export-mode";

/**
 * Web-package security artifacts (spec §4/§5/§6).
 *
 * robots.txt stays "Allow: /" in EVERY mode — deliberate (alignment ruling
 * 2026-07-04): noindex only works when crawlers can fetch the page and see it
 * (spec §4.4 rationale), so link-only/password protection rides on per-page
 * noindex meta + X-Robots-Tag headers, never on robots.txt Disallow.
 */
export function robotsTxt(): string {
	return "User-agent: *\nAllow: /\n";
}

const HEADERS_BLOCK = `<IfModule mod_headers.c>
  Header set X-Robots-Tag "noindex, nofollow, noarchive, nosnippet, noimageindex"
  Header set Referrer-Policy "no-referrer"
  Header set X-Content-Type-Options "nosniff"
</IfModule>`;

/**
 * Diagnostics blocker — pattern matches the ACTUAL _notepack filenames
 * (url-map.json / asset-map.json / attachment-manifest.json / export-report.*
 * / note-index.json). The spec §4.3 draft named note-url-map/base-url-map,
 * which match nothing on disk; corrected here (user-approved plan 2026-07-04).
 * Diagnostics are not emitted in web modes by default (§3.2) — this is the
 * second fence for "include diagnostics" exports.
 */
const DIAG_BLOCK = `<FilesMatch "^(export-report|url-map|asset-map|attachment-manifest|note-index)\\.">
  Require all denied
</FilesMatch>`;

/** Public mode (§6): indexable, but no directory listings / MIME sniffing. */
const PUBLIC_HTACCESS = `Options -Indexes
DirectoryIndex START_HERE.html

<IfModule mod_headers.c>
  Header set X-Content-Type-Options "nosniff"
</IfModule>
`;

/** Link-only mode (§4.3). */
const LINK_ONLY_HTACCESS = `Options -Indexes
DirectoryIndex START_HERE.html

${HEADERS_BLOCK}

${DIAG_BLOCK}
`;

/**
 * Password mode root (§5.2): everything routes through index.php; direct
 * requests into the private tree 404 before PHP is even consulted.
 */
function passwordRootHtaccess(privateSubdir: string): string {
	return `Options -Indexes
DirectoryIndex index.php

${HEADERS_BLOCK}

RewriteEngine On
RewriteRule ^(?:index|logout)\\.php$ - [L]
RewriteRule ^${privateSubdir} - [R=404,L]
RewriteRule ^(.*)$ index.php?np_path=$1 [QSA,L]
`;
}

/**
 * Private folder deny (§5.3) — Apache 2.4 syntax with a guarded 2.2 fallback
 * (unguarded "Deny from all" 500s on 2.4 without mod_access_compat).
 */
export function privateDenyHtaccess(): string {
	return `<IfModule mod_authz_core.c>
  Require all denied
</IfModule>
<IfModule !mod_authz_core.c>
  Order allow,deny
  Deny from all
</IfModule>
`;
}

/** Root .htaccess for the plan's mode (null → no .htaccess: local/zip). */
export function rootHtaccess(plan: ModePlan): string | null {
	switch (plan.htaccess) {
		case "public":
			return PUBLIC_HTACCESS;
		case "link-only":
			return LINK_ONLY_HTACCESS;
		case "password":
			if (plan.privateSubdir === null) {
				throw new Error("password 模式缺少 privateSubdir（loud fail）");
			}
			return passwordRootHtaccess(plan.privateSubdir);
		default:
			return null;
	}
}

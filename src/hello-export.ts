import { App, PluginManifest, apiVersion } from "obsidian";
import { createNewExportFolder } from "./vault-io";
import { resolveAbsolutePath, tryOpenInBrowser } from "./open-external";

export interface HelloExportResult {
	/** vault-relative path of the generated page */
	indexPath: string;
	/** absolute filesystem path, when the vault is on a normal disk */
	absoluteIndexPath: string | null;
	/** which mechanism successfully opened the page in a browser, or null */
	openedWith: string | null;
}

/**
 * Phase 0 "hello" export: write one self-contained HTML page into a brand-new
 * timestamped folder inside the vault, then try to open it in the default browser.
 * Never overwrites anything: the target folder is timestamped and must be new.
 */
export async function runHelloExport(
	app: App,
	manifest: PluginManifest,
): Promise<HelloExportResult> {
	const now = new Date();
	const exportFolder = await createNewExportFolder(app, "hello");
	const indexPath = `${exportFolder}/index.html`;

	const markdownCount = app.vault
		.getFiles()
		.filter((f) => f.extension === "md").length;

	const html = buildHelloHtml({
		generatedAt: now.toLocaleString(),
		vaultName: app.vault.getName(),
		obsidianApiVersion: apiVersion,
		pluginVersion: manifest.version,
		markdownCount,
		indexPath,
	});
	await app.vault.create(indexPath, html);

	const absoluteIndexPath = resolveAbsolutePath(app, indexPath);
	const openedWith = await tryOpenInBrowser(app, indexPath, absoluteIndexPath);

	return { indexPath, absoluteIndexPath, openedWith };
}

interface HelloPageData {
	generatedAt: string;
	vaultName: string;
	obsidianApiVersion: string;
	pluginVersion: string;
	markdownCount: number;
	indexPath: string;
}

function buildHelloHtml(d: HelloPageData): string {
	const esc = (s: string) =>
		s
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;");
	return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>VaultPack 階段 0 測試頁</title>
<style>
  body { font-family: -apple-system, "Helvetica Neue", "PingFang TC", sans-serif;
         max-width: 42rem; margin: 3rem auto; padding: 0 1.25rem; line-height: 1.7;
         color: #1f2328; background: #fafafa; }
  h1 { font-size: 1.5rem; border-bottom: 2px solid #7c5cff; padding-bottom: .5rem; }
  table { border-collapse: collapse; width: 100%; margin: 1rem 0; background: #fff; }
  td, th { border: 1px solid #ddd; padding: .5rem .75rem; text-align: left; }
  th { background: #f0edff; width: 12rem; }
  .ok { color: #0a7a2f; font-weight: 600; }
  footer { margin-top: 2rem; font-size: .85rem; color: #777; }
</style>
</head>
<body>
<h1>VaultPack 階段 0 測試頁 <span class="ok">✓ 匯出管線通了</span></h1>
<p>這一頁由 VaultPack 外掛在真 Obsidian 裡產生。你能在瀏覽器看到它，代表「外掛載入 → 按一下 → 產出網頁」整條路是通的。</p>
<table>
  <tr><th>產生時間</th><td>${esc(d.generatedAt)}</td></tr>
  <tr><th>來源 vault</th><td>${esc(d.vaultName)}</td></tr>
  <tr><th>Obsidian API 版本</th><td>${esc(d.obsidianApiVersion)}</td></tr>
  <tr><th>VaultPack 版本</th><td>${esc(d.pluginVersion)}</td></tr>
  <tr><th>vault 內筆記數</th><td>${d.markdownCount} 篇 Markdown</td></tr>
  <tr><th>本頁路徑</th><td><code>${esc(d.indexPath)}</code></td></tr>
</table>
<p>下一步（階段 1）：把第一個 Base 匯成真正的表格頁。</p>
<footer>VaultPack v2 — Phase 0 hello export</footer>
</body>
</html>
`;
}

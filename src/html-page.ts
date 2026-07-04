import { PluginManifest } from "obsidian";
import { PAGE_CSS, TOKENS_CSS } from "./design-tokens";
import { NpLocale, t } from "./i18n";

export function footer(locale: NpLocale, manifest: PluginManifest): string {
	return `<footer class="np-footer">${t(locale, "footerLine")} — VaultPack v${escapeHtml(manifest.version)}</footer>`;
}

/** plain text of an HTML fragment (for the offline search index), capped.
 * style/script elements are dropped first — Mermaid injects <style> into its
 * SVG and that CSS was polluting search snippets (user report 2026-07-04). */
export function plainTextOf(html: string, cap = 2500): string {
	const doc = new DOMParser().parseFromString(
		`<body>${html}</body>`,
		"text/html",
	);
	for (const el of Array.from(doc.body.querySelectorAll("style, script"))) {
		el.remove();
	}
	return (doc.body.textContent ?? "")
		.replace(/\s+/gu, " ")
		.trim()
		.slice(0, cap);
}

export function escapeHtml(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

const HTML_LANG: Record<NpLocale, string> = {
	en: "en",
	"zh-TW": "zh-Hant-TW",
	ja: "ja",
};

/** body class attribute: wide layout + sidebar-aware layout flags */
function bodyClassAttr(wide: boolean, hasNav: boolean): string {
	const cls = [...(wide ? ["np-wide"] : []), ...(hasNav ? ["np-has-nav"] : [])];
	return cls.length > 0 ? ` class="${cls.join(" ")}"` : "";
}

/** Self-contained page shell: tokens + page CSS inlined, zero dependencies. */
export interface PageChrome {
	/** relative href of START_HERE from this page */
	homeHref: string;
	/** relative prefix from this page to the package root ("" or "../") */
	rootPrefix: string;
	/** relative prefix from this page to _notepack/ */
	notepackBase: string;
	/** package title shown at the top of the sidebar (custom or default) */
	packageTitle: string;
}

/** Web-mode page hardening (spec §4.2) — off in local/zip/public modes. */
export interface PageSecurity {
	/** <meta name="robots" noindex…> on every page */
	noindexMeta: boolean;
	/** <meta name="referrer" content="no-referrer"> on every page */
	noReferrerMeta: boolean;
	/** upgrade every external <a> to rel="noopener noreferrer" */
	relNoreferrer: boolean;
}

/**
 * DOM-level pass (not regex — attribute values may contain ">"):
 * every external link gets rel="noopener noreferrer" (spec §4.2). Element-
 * level referrerpolicy attrs (YouTube iframes) are left alone on purpose —
 * they override the page meta and YouTube needs its Referer to play.
 */
export function applyExternalLinkRel(html: string): string {
	const doc = new DOMParser().parseFromString(html, "text/html");
	for (const a of Array.from(
		doc.querySelectorAll<HTMLAnchorElement>(
			'a[href^="http://"], a[href^="https://"]',
		),
	)) {
		const rel = new Set(
			(a.getAttribute("rel") ?? "").split(/\s+/u).filter((s) => s !== ""),
		);
		rel.add("noreferrer");
		rel.add("noopener");
		a.setAttribute("rel", [...rel].join(" "));
	}
	return `<!DOCTYPE html>\n${doc.documentElement.outerHTML}\n`;
}

export function buildPage(opts: {
	locale: NpLocale;
	title: string;
	bodyHtml: string;
	/** wide layout (~86vw) for Bases pages; notes keep the reading width */
	wide?: boolean;
	/** page-specific stylesheet payload (e.g. captured MathJax styles) */
	extraCss?: string;
	/**
	 * relative hrefs to the shared stylesheets (_notepack/theme.css etc.).
	 * When omitted, styles are inlined (single-page exports stay portable).
	 */
	cssHrefs?: string[];
	/** sidebar (title + search + tree) + mobile top bar (user req 2026-07-04) */
	chrome?: PageChrome;
	/** this page's url relative to the package root (nav current-highlight) */
	pagePath?: string;
	/** web-mode hardening (noindex / no-referrer / rel) — spec §4.2 */
	security?: PageSecurity;
}): string {
	const styles =
		opts.cssHrefs !== undefined && opts.cssHrefs.length > 0
			? opts.cssHrefs
					.map(
						(h) => `<link rel="stylesheet" href="${escapeHtml(h)}">`,
					)
					.join("\n")
			: `<style>${TOKENS_CSS}${PAGE_CSS}</style>`;
	// Publish-style sidebar (user req 2026-07-04): package title + offline
	// search + folder tree (tree renders via nav.js). The thin top bar stays
	// as the mobile entry point (menu button + home) and hides on desktop.
	const chromeHtml = opts.chrome
		? `<aside class="np-sidebar">` +
			`<div class="np-side-title"><a href="${escapeHtml(opts.chrome.homeHref)}">${escapeHtml(opts.chrome.packageTitle)}</a></div>` +
			`<div class="np-search">` +
			`<input type="search" class="np-search-input" placeholder="${escapeHtml(t(opts.locale, "searchPlaceholder"))}">` +
			`<div class="np-search-results" hidden></div>` +
			`</div>` +
			`<nav class="np-nav-tree"></nav>` +
			`</aside>` +
			`<div class="np-backdrop"></div>` +
			`<header class="np-topbar">` +
			`<button type="button" class="np-nav-btn" aria-label="${escapeHtml(t(opts.locale, "menu"))}">☰</button>` +
			`<a class="np-home" href="${escapeHtml(opts.chrome.homeHref)}">⌂ ${escapeHtml(t(opts.locale, "home"))}</a>` +
			`</header>`
		: "";
	const searchScripts = opts.chrome
		? `\n<script src="${escapeHtml(opts.chrome.notepackBase)}search-index.js"></script>` +
			`\n<script src="${escapeHtml(opts.chrome.notepackBase)}search.js"></script>` +
			`\n<script src="${escapeHtml(opts.chrome.notepackBase)}nav-index.js"></script>` +
			`\n<script src="${escapeHtml(opts.chrome.notepackBase)}nav.js"></script>`
		: "";
	const securityMeta =
		(opts.security?.noindexMeta
			? `\n<meta name="robots" content="noindex,nofollow,noarchive,nosnippet,noimageindex">`
			: "") +
		(opts.security?.noReferrerMeta
			? `\n<meta name="referrer" content="no-referrer">`
			: "");
	const html = `<!DOCTYPE html>
<html lang="${HTML_LANG[opts.locale]}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">${securityMeta}
<title>${escapeHtml(opts.title)}</title>
${styles}${opts.extraCss ? `\n<style>${opts.extraCss}</style>` : ""}
</head>
<body${bodyClassAttr(opts.wide === true, opts.chrome !== undefined)} data-np-root="${escapeHtml(opts.chrome?.rootPrefix ?? "")}"${opts.pagePath !== undefined ? ` data-np-page="${escapeHtml(opts.pagePath)}"` : ""}>
${chromeHtml}${searchScripts}
${opts.bodyHtml}
<script>
// heading fold (offline, no dependencies): default open, click arrow to fold
document.addEventListener("click", function (e) {
  var el = e.target instanceof Element ? e.target : null;
  var btn = el && el.closest ? el.closest(".np-fold-btn") : null;
  if (btn) {
    var sec = btn.closest(".np-hsec");
    if (sec) sec.classList.toggle("np-folded");
  }
  // foldable callouts (Obsidian [!type]- / [!type]+)
  var ct = el && el.closest ? el.closest(".callout-title") : null;
  if (ct) {
    var co = ct.closest(".callout");
    if (co && co.classList.contains("is-collapsible")) {
      co.classList.toggle("is-collapsed");
    }
  }
  // offline copy button for code blocks
  var copy = el && el.closest ? el.closest(".np-copy") : null;
  if (copy) {
    var pre = copy.closest("pre");
    var code = pre ? pre.querySelector("code") : null;
    var text = code ? code.textContent : "";
    function done(ok) {
      copy.textContent = ok ? "✓" : "✕";
      window.setTimeout(function () { copy.textContent = "Copy"; }, 1200);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        function () { done(true); },
        function () { done(false); }
      );
    } else {
      var ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (err) { ok = false; }
      ta.remove();
      done(ok);
    }
  }
});
// YouTube can't play from file:// (needs a Referer since late 2025) —
// locally, swap players for bundled-thumbnail cards that link out;
// when this package is hosted over http(s) the real player stays.
(function () {
  if (location.protocol !== "file:") return;
  var vids = document.querySelectorAll(".np-video");
  Array.prototype.forEach.call(vids, function (v) {
    var f = v.querySelector("iframe");
    if (f) f.remove();
    var a = document.createElement("a");
    a.className = "np-video-open";
    a.href = v.getAttribute("data-page-url") || "#";
    a.target = "_blank";
    a.rel = "noopener";
    var p = document.createElement("span");
    p.className = "np-play";
    p.textContent = "▶";
    a.appendChild(p);
    v.appendChild(a);
  });
})();
// view switcher (base pages): one view at a time; #view-X hash deep-links;
// without JS every view simply stacks — graceful degradation for archival.
(function () {
  var tabs = document.querySelector(".np-view-tabs");
  if (!tabs) return;
  document.body.classList.add("np-tabs-on");
  var sections = Array.prototype.slice.call(
    document.querySelectorAll("section.np-view")
  );
  var btns = Array.prototype.slice.call(
    tabs.querySelectorAll(".np-view-tab")
  );
  function activate(id, push) {
    sections.forEach(function (s) {
      s.style.display = s.id === id ? "" : "none";
    });
    btns.forEach(function (b) {
      b.classList.toggle("np-active", b.getAttribute("data-view") === id);
    });
    if (push && history.replaceState) {
      history.replaceState(null, "", "#" + id);
    }
  }
  btns.forEach(function (b) {
    b.addEventListener("click", function () {
      activate(b.getAttribute("data-view"), true);
    });
  });
  function fromHash() {
    var h = decodeURIComponent(location.hash.replace(/^#/, ""));
    var known = sections.some(function (s) { return s.id === h; });
    activate(known ? h : sections.length ? sections[0].id : "", false);
  }
  window.addEventListener("hashchange", fromHash);
  fromHash();
})();
</script>
</body>
</html>
`;
	// rel pass LAST so it sees the final document (link-only/password modes)
	return opts.security?.relNoreferrer === true
		? applyExternalLinkRel(html)
		: html;
}

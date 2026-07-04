import { App, requestUrl } from "obsidian";
import { NpLocale, t } from "./i18n";
import { ensureFolder, sanitizeFileName } from "./vault-io";

/**
 * 5e: external embeds (YouTube / Twitter iframes) → static oEmbed cards.
 *
 * Why: Obsidian renders these as sandboxed iframes that stay blank from
 * file:// even online (2026-07-03 finding). At export time we're inside the
 * app WITH network, so we fetch the public oEmbed metadata + thumbnail once,
 * bundle the thumbnail into assets/, and emit an offline-readable card that
 * links out. No metadata reachable → fallback card with the plain link.
 */
export interface OembedCard {
	provider: string;
	title: string;
	author: string;
	thumbAssetName: string | null;
	/** Twitter: official oEmbed blockquote HTML (scripts stripped) */
	tweetHtml: string | null;
}
export interface OembedCtx {
	exportFolder: string;
	/** shared asset map; thumbnail keys are namespaced as `url:<thumbUrl>` */
	assets: Map<string, string>;
	/** page URL → card (null = fetch failed; don't retry within this run) */
	cache: Map<string, OembedCard | null>;
}

interface Detected {
	provider: "YouTube" | "Twitter";
	pageUrl: string;
	/** YouTube video id when applicable */
	videoId: string | null;
}

function detectExternalEmbed(iframe: Element): Detected | null {
	const src = iframe.getAttribute("src") ?? "";
	// Obsidian proxies YouTube embeds via releases.obsidian.md/youtube?v=…
	// (2026-07-03 disk evidence) — recognize both that and direct embeds.
	const yt =
		/releases\.obsidian\.md\/youtube\?[^"']*v=([\w-]{6,})/u.exec(src) ??
		/youtube(?:-nocookie)?\.com\/embed\/([\w-]{6,})/u.exec(src);
	if (yt !== null) {
		return {
			provider: "YouTube",
			pageUrl: `https://www.youtube.com/watch?v=${yt[1]}`,
			videoId: yt[1],
		};
	}
	const tw = /platform\.twitter\.com\/embed\/Tweet\.html\?[^"']*id=(\d+)/u.exec(
		src,
	);
	if (tw !== null) {
		return {
			provider: "Twitter",
			pageUrl: `https://twitter.com/i/status/${tw[1]}`,
			videoId: null,
		};
	}
	return null;
}

/** Replace every recognized external-embed iframe under `root` with a card. */
export async function replaceExternalEmbeds(
	app: App,
	root: HTMLElement,
	ctx: OembedCtx,
	dbg: Record<string, unknown>,
	locale: NpLocale,
	assetSrcPrefix: string,
): Promise<void> {
	const iframes = Array.from(root.querySelectorAll("iframe"));
	if (iframes.length === 0) {
		return;
	}
	const log: Array<Record<string, unknown>> = [];
	dbg.oembeds = log;
	for (const frame of iframes) {
		const det = detectExternalEmbed(frame);
		if (det === null) {
			log.push({ src: frame.getAttribute("src"), skipped: "unknown-provider" });
			continue;
		}
		let card = ctx.cache.get(det.pageUrl);
		if (card === undefined) {
			card = await fetchOembedCard(app, det, ctx);
			ctx.cache.set(det.pageUrl, card);
		}
		frame.replaceWith(buildCardEl(card, det, locale, assetSrcPrefix));
		log.push({
			url: det.pageUrl,
			fetched: card !== null,
			thumb: card?.thumbAssetName ?? null,
		});
	}
}

async function fetchOembedCard(
	app: App,
	det: Detected,
	ctx: OembedCtx,
): Promise<OembedCard | null> {
	const endpoint =
		det.provider === "YouTube"
			? `https://www.youtube.com/oembed?url=${encodeURIComponent(det.pageUrl)}&format=json`
			: `https://publish.twitter.com/oembed?url=${encodeURIComponent(det.pageUrl)}&omit_script=1&hide_thread=1`;
	try {
		const res = await requestUrl({ url: endpoint, throw: false });
		if (res.status !== 200) {
			return null;
		}
		const j = res.json as {
			title?: unknown;
			author_name?: unknown;
			provider_name?: unknown;
			thumbnail_url?: unknown;
			html?: unknown;
		};
		let title = typeof j.title === "string" ? j.title : "";
		if (title === "" && typeof j.html === "string") {
			// Twitter: the tweet text lives inside the returned blockquote HTML
			const tmp = document.createElement("div");
			tmp.innerHTML = j.html;
			title = (tmp.textContent ?? "").trim().slice(0, 220);
		}
		const thumbUrl =
			typeof j.thumbnail_url === "string" ? j.thumbnail_url : null;
		let tweetHtml: string | null = null;
		if (det.provider === "Twitter" && typeof j.html === "string") {
			const tmp = document.createElement("div");
			tmp.innerHTML = j.html;
			for (const s of Array.from(tmp.querySelectorAll("script"))) {
				s.remove();
			}
			tweetHtml = tmp.innerHTML;
		}
		return {
			provider:
				typeof j.provider_name === "string" ? j.provider_name : det.provider,
			title,
			author: typeof j.author_name === "string" ? j.author_name : "",
			thumbAssetName:
				thumbUrl !== null
					? await downloadThumb(app, ctx, thumbUrl)
					: null,
			tweetHtml,
		};
	} catch {
		return null;
	}
}

async function downloadThumb(
	app: App,
	ctx: OembedCtx,
	thumbUrl: string,
): Promise<string | null> {
	const key = `url:${thumbUrl}`;
	const existing = ctx.assets.get(key);
	if (existing !== undefined) {
		return existing;
	}
	try {
		const res = await requestUrl({ url: thumbUrl, throw: false });
		if (res.status !== 200) {
			return null;
		}
		await ensureFolder(app, `${ctx.exportFolder}/assets`);
		const lastSeg =
			thumbUrl.split("?")[0].split("/").filter(Boolean).pop() ?? "thumb.jpg";
		let name = sanitizeFileName(`oembed-${lastSeg}`);
		const taken = new Set(ctx.assets.values());
		if (taken.has(name)) {
			const dot = name.lastIndexOf(".");
			const stem = dot > 0 ? name.slice(0, dot) : name;
			const ext = dot > 0 ? name.slice(dot) : "";
			let i = 2;
			while (taken.has(`${stem}-${i}${ext}`)) {
				i++;
			}
			name = `${stem}-${i}${ext}`;
		}
		await app.vault.createBinary(
			`${ctx.exportFolder}/assets/${name}`,
			res.arrayBuffer,
		);
		ctx.assets.set(key, name);
		return name;
	} catch {
		return null;
	}
}

/**
 * Online-interactive, offline-degrading embeds (user decision 2026-07-03):
 * - YouTube: a REAL playable iframe (plays in-page when online) layered over
 *   the bundled thumbnail, with a caption link below.
 * - Twitter: the official oEmbed blockquote + widgets.js → real tweet online,
 *   styled readable quote offline.
 * - No metadata at all → plain fallback card with the link.
 */
function buildCardEl(
	card: OembedCard | null,
	det: Detected,
	locale: NpLocale,
	assetSrcPrefix: string,
): HTMLElement {
	if (det.provider === "YouTube" && det.videoId !== null) {
		const wrap = document.createElement("div");
		wrap.className = "np-embed-block";
		const video = document.createElement("div");
		video.className = "np-video";
		if (card?.thumbAssetName) {
			video.style.backgroundImage = `url("${assetSrcPrefix}${encodeURI(card.thumbAssetName)}")`;
		}
		// YouTube (late-2025 policy) requires a real Referer — plays when this
		// package is hosted over http(s); from file:// the page script swaps
		// the iframe for a thumbnail card (Error 153 is structural there).
		video.setAttribute("data-page-url", det.pageUrl);
		const frame = document.createElement("iframe");
		frame.src = `https://www.youtube-nocookie.com/embed/${det.videoId}`;
		frame.setAttribute("allowfullscreen", "");
		frame.setAttribute(
			"allow",
			"accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture",
		);
		frame.setAttribute("frameborder", "0");
		frame.setAttribute("loading", "lazy");
		frame.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
		video.appendChild(frame);
		wrap.appendChild(video);
		const caption = document.createElement("a");
		caption.className = "np-embed-caption-row";
		caption.href = det.pageUrl;
		caption.target = "_blank";
		caption.rel = "noopener";
		caption.textContent =
			card !== null && card.title !== ""
				? `${card.title} — ${card.provider}${card.author !== "" ? " · " + card.author : ""}`
				: det.pageUrl;
		wrap.appendChild(caption);
		return wrap;
	}
	if (det.provider === "Twitter" && card?.tweetHtml) {
		const wrap = document.createElement("div");
		wrap.className = "np-embed-block np-tweet";
		wrap.innerHTML = card.tweetHtml;
		// widgets.js upgrades the blockquote to a real tweet when online;
		// executes in the exported page only (injected scripts don't run here).
		const s = document.createElement("script");
		s.setAttribute("async", "");
		s.src = "https://platform.twitter.com/widgets.js";
		s.setAttribute("charset", "utf-8");
		wrap.appendChild(s);
		return wrap;
	}
	return buildLinkCard(card, det, locale, assetSrcPrefix);
}

function buildLinkCard(
	card: OembedCard | null,
	det: Detected,
	locale: NpLocale,
	assetSrcPrefix: string,
): HTMLElement {
	const a = document.createElement("a");
	a.className = "np-oembed";
	a.href = det.pageUrl;
	a.target = "_blank";
	a.rel = "noopener";
	if (card === null) {
		a.classList.add("np-oembed-fallback");
		const body = document.createElement("div");
		body.className = "np-oembed-body";
		const title = document.createElement("div");
		title.className = "np-oembed-title";
		title.textContent = `${t(locale, "externalEmbed")} ↗`;
		const meta = document.createElement("div");
		meta.className = "np-oembed-meta";
		meta.textContent = det.pageUrl;
		body.appendChild(title);
		body.appendChild(meta);
		a.appendChild(body);
		return a;
	}
	if (card.thumbAssetName !== null) {
		const thumb = document.createElement("div");
		thumb.className = "np-oembed-thumb";
		const img = document.createElement("img");
		img.src = `${assetSrcPrefix}${encodeURI(card.thumbAssetName)}`;
		img.alt = "";
		img.loading = "lazy";
		thumb.appendChild(img);
		a.appendChild(thumb);
	}
	const body = document.createElement("div");
	body.className = "np-oembed-body";
	const title = document.createElement("div");
	title.className = "np-oembed-title";
	title.textContent = card.title !== "" ? card.title : det.pageUrl;
	const meta = document.createElement("div");
	meta.className = "np-oembed-meta";
	meta.textContent =
		card.author !== "" ? `${card.provider} · ${card.author}` : card.provider;
	body.appendChild(title);
	body.appendChild(meta);
	a.appendChild(body);
	return a;
}

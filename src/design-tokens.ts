/**
 * Design tokens for every exported page (REQUIREMENTS.md v1.1: token-based
 * styling so the whole look can be swapped later).
 *
 * Default theme: Notion-flavored. Color values taken from the user-provided
 * reference repo bogdanaks/notion-ui-react (src/shared/configs/colors.ts):
 * text #37352f, muted gray rgba(120,119,116), subtle bg rgba(241,241,239),
 * accent blue rgba(51,126,169); 16px / 1.5 typography.
 * Spacing/radius/border are design choices in the same spirit.
 *
 * Rule: page/table CSS may ONLY use var(--np-*) — never raw values.
 */
export const TOKENS_CSS = `
:root {
  /* color */
  --np-color-text: #37352f;
  --np-color-text-muted: rgba(120, 119, 116, 1);
  --np-color-bg: #ffffff;
  --np-color-bg-subtle: rgba(241, 241, 239, 1);
  --np-color-border: rgba(233, 233, 231, 1);
  --np-color-border-strong: rgba(190, 188, 183, 1);
  --np-color-accent: rgba(51, 126, 169, 1);
  --np-color-error-bg: rgba(253, 235, 236, 1);
  --np-color-error-text: rgba(212, 76, 71, 1);
  /* typography */
  --np-font-family: -apple-system, BlinkMacSystemFont, "Segoe UI",
    "PingFang TC", "Hiragino Sans", "Noto Sans CJK TC", sans-serif;
  --np-font-size: 16px;
  --np-font-size-sm: 13px;
  --np-line-height: 1.5;
  /* shape & space */
  --np-radius: 4px;
  --np-space-1: 4px;
  --np-space-2: 8px;
  --np-space-3: 16px;
  --np-space-4: 32px;
  /* normal notes keep a reading width; Bases pages go wide (user req: ~80-90%) */
  --np-page-max-width: 60rem;
  --np-page-max-width-wide: 86vw;
  /* Publish-style left sidebar (user req 2026-07-04) */
  --np-sidebar-width: 260px;
  --np-color-backdrop: rgba(0, 0, 0, 0.25);
  /* horizontal page padding — the topbar's full-bleed negative margin MUST
     mirror this exactly (probe 2026-07-04: hardcoded -space-3 vs mobile
     space-2 padding = 8px overflow per side → horizontal scrollbar) */
  --np-page-pad-x: var(--np-space-3);
  /* anti "one character per line" degenerate column (user-reported past bug) */
  --np-table-col-min: 6em;
}
`;

/** Base page + table styles, built exclusively on the tokens above. */
export const PAGE_CSS = `
*, *::before, *::after {
  box-sizing: border-box;
}
body {
  font-family: var(--np-font-family);
  font-size: var(--np-font-size);
  line-height: var(--np-line-height);
  color: var(--np-color-text);
  background: var(--np-color-bg);
  max-width: var(--np-page-max-width);
  margin: 0 auto;
  padding: var(--np-space-4) var(--np-page-pad-x);
}
h1 {
  font-size: 1.75em;
  font-weight: 700;
  margin: 0 0 var(--np-space-3);
}
.np-meta {
  font-size: var(--np-font-size-sm);
  color: var(--np-color-text-muted);
  margin-bottom: var(--np-space-3);
}
.np-meta span + span::before {
  content: "·";
  margin: 0 var(--np-space-2);
}
a {
  color: var(--np-color-accent);
  text-decoration: none;
}
a:hover {
  text-decoration: underline;
}
.np-banner {
  background: var(--np-color-bg-subtle);
  border: 1px solid var(--np-color-border);
  border-radius: var(--np-radius);
  padding: var(--np-space-2) var(--np-space-3);
  color: var(--np-color-text-muted);
  font-size: var(--np-font-size-sm);
  margin: var(--np-space-3) 0;
}
pre.np-raw {
  background: var(--np-color-bg-subtle);
  border-radius: var(--np-radius);
  padding: var(--np-space-3);
  font-size: var(--np-font-size-sm);
  line-height: 1.6;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
/* properties block (frontmatter) — Notion-ish key/value list */
table.np-props {
  border-collapse: collapse;
  margin: var(--np-space-3) 0;
  font-size: var(--np-font-size-sm);
}
.np-props th {
  color: var(--np-color-text-muted);
  font-weight: 500;
  text-align: left;
  padding: var(--np-space-1) var(--np-space-3) var(--np-space-1) 0;
  vertical-align: top;
  white-space: nowrap;
}
.np-props td {
  padding: var(--np-space-1) 0;
}
.np-chip {
  display: inline-block;
  background: var(--np-color-bg-subtle);
  border-radius: var(--np-radius);
  padding: 0 var(--np-space-2);
  margin: 1px var(--np-space-1) 1px 0;
}
/* link whose target is outside this export package: visible but inert */
.np-link-out {
  color: var(--np-color-text-muted);
  border-bottom: 1px dotted var(--np-color-text-muted);
  cursor: help;
}
/* rendered note body */
.np-note-content { margin-top: var(--np-space-3); }
.np-note-content img { max-width: 100%; height: auto; border-radius: var(--np-radius); }
.np-note-content blockquote {
  border-left: 3px solid var(--np-color-border);
  margin: var(--np-space-2) 0;
  padding: 0 var(--np-space-3);
  color: var(--np-color-text-muted);
}
.np-note-content code {
  background: var(--np-color-bg-subtle);
  border-radius: var(--np-radius);
  padding: 0 var(--np-space-1);
  font-size: 0.9em;
}
/* fenced code blocks: one solid block, not per-line inline pills */
.np-note-content pre {
  position: relative;
  background: var(--np-color-bg-subtle);
  border-radius: var(--np-radius);
  padding: var(--np-space-3);
  overflow-x: auto;
  line-height: 1.6;
}
.np-note-content pre code {
  background: none;
  border-radius: 0;
  padding: 0;
  display: block;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
/* markdown tables inside notes: bordered, Obsidian-like */
.np-note-content table {
  border-collapse: collapse;
  margin: var(--np-space-2) 0;
}
.np-note-content table th,
.np-note-content table td {
  border: 1px solid var(--np-color-border);
  padding: var(--np-space-1) var(--np-space-2);
}
.np-note-content table th {
  background: var(--np-color-bg-subtle);
  font-weight: 600;
}
/* external embeds (YouTube etc.): Obsidian's iframes arrive unsized and
   collapse to nothing — give them a real frame (they need internet) */
.np-note-content iframe {
  width: 100%;
  aspect-ratio: 16 / 9;
  border: 0;
  border-radius: var(--np-radius);
  background: var(--np-color-bg-subtle);
}
.np-note-content iframe[src*="twitter.com"],
.np-note-content iframe[src*="x.com"] {
  aspect-ratio: auto;
  min-height: 360px;
}
/* math (SVG output: self-contained glyphs, offline-complete) */
.np-math svg {
  vertical-align: middle;
  max-width: 100%;
}
.np-math-block {
  text-align: center;
  margin: var(--np-space-3) 0;
  overflow-x: auto;
}
/* online-playable embeds with offline degradation */
.np-embed-block {
  max-width: 640px;
  margin: var(--np-space-2) 0;
}
.np-video {
  position: relative;
  aspect-ratio: 16 / 9;
  background: var(--np-color-bg-subtle) center / cover no-repeat;
  border-radius: var(--np-radius);
  overflow: hidden;
}
.np-video iframe {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: 0;
  aspect-ratio: auto;
}
.np-embed-caption-row {
  display: block;
  font-size: var(--np-font-size-sm);
  color: var(--np-color-text-muted);
  margin-top: var(--np-space-1);
  overflow-wrap: anywhere;
}
.np-embed-caption-row:hover {
  color: var(--np-color-accent);
}
/* PDF embeds: browser-native viewer in an iframe + open-in-tab caption */
.np-pdf {
  margin: var(--np-space-2) 0;
}
.np-pdf iframe {
  width: 100%;
  height: 75vh;
  border: 1px solid var(--np-color-border);
  border-radius: var(--np-radius);
  background: var(--np-color-bg-subtle);
}
/* local (file://) YouTube fallback: thumbnail + play button linking out */
.np-video-open {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.np-play {
  width: 64px;
  height: 44px;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.75);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
}
.np-video-open:hover .np-play {
  background: rgba(212, 76, 71, 1);
}
/* offline fallback styling for the official tweet blockquote */
.np-tweet blockquote.twitter-tweet {
  border: 1px solid var(--np-color-border);
  border-left: 3px solid var(--np-color-accent);
  border-radius: var(--np-radius);
  margin: 0;
  padding: var(--np-space-2) var(--np-space-3);
  color: var(--np-color-text);
}
/* oEmbed static cards (external content bundled as thumbnail + link) */
a.np-oembed {
  display: block;
  max-width: 560px;
  border: 1px solid var(--np-color-border);
  border-radius: var(--np-radius);
  overflow: hidden;
  margin: var(--np-space-2) 0;
  color: var(--np-color-text);
  background: var(--np-color-bg);
}
a.np-oembed:hover {
  text-decoration: none;
  background: var(--np-color-bg-subtle);
}
.np-oembed-thumb img {
  width: 100%;
  display: block;
}
.np-oembed-body {
  padding: var(--np-space-2) var(--np-space-3);
}
.np-oembed-title {
  font-weight: 600;
}
.np-oembed-meta {
  font-size: var(--np-font-size-sm);
  color: var(--np-color-text-muted);
  margin-top: 2px;
  overflow-wrap: anywhere;
}
/* inline tag chip (inert offline; may link to search in phase 8) */
.np-tag {
  background: var(--np-color-bg-subtle);
  border-radius: 999px;
  padding: 0 var(--np-space-2);
  color: var(--np-color-accent);
  font-size: 0.9em;
}
/* task lists: no bullets, frozen custom checkboxes with Minimal-theme states */
.np-note-content ul.contains-task-list {
  list-style: none;
  padding-left: 1.7em;
}
.np-note-content li.task-list-item {
  position: relative;
}
.np-check {
  position: absolute;
  left: -1.7em;
  top: 0.2em;
  width: 1.15em;
  height: 1.15em;
  border: 1.5px solid var(--np-color-border-strong);
  border-radius: 4px;
  background: var(--np-color-bg);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8em;
  line-height: 1;
  user-select: none;
}
.np-check::before { content: ""; }
.np-check[data-task="x"] { background: rgba(51, 126, 169, 1); border-color: rgba(51, 126, 169, 1); color: #fff; }
.np-check[data-task="x"]::before { content: "✓"; }
.np-check[data-task="/"] { background: linear-gradient(90deg, rgba(51, 126, 169, 0.45) 50%, transparent 50%); }
.np-check[data-task="-"] { color: var(--np-color-text-muted); }
.np-check[data-task="-"]::before { content: "−"; }
.np-check[data-task=">"]::before { content: "→"; }
.np-check[data-task="<"]::before { content: "↺"; }
.np-check[data-task="?"] { border-color: rgba(203, 145, 47, 1); color: rgba(203, 145, 47, 1); }
.np-check[data-task="?"]::before { content: "?"; }
.np-check[data-task="!"] { border-color: rgba(212, 76, 71, 1); color: rgba(212, 76, 71, 1); }
.np-check[data-task="!"]::before { content: "!"; }
.np-check[data-task="*"] { border-color: rgba(203, 145, 47, 1); color: rgba(203, 145, 47, 1); }
.np-check[data-task="*"]::before { content: "★"; }
.np-check[data-task="\\""]::before { content: "❝"; }
.np-check[data-task="l"]::before { content: "📍"; }
.np-check[data-task="b"]::before { content: "🔖"; }
.np-check[data-task="i"]::before { content: "ℹ"; }
.np-check[data-task="S"]::before { content: "💲"; }
.np-check[data-task="I"]::before { content: "💡"; }
.np-check[data-task="p"]::before { content: "👍"; }
.np-check[data-task="c"]::before { content: "👎"; }
.np-check[data-task="f"]::before { content: "🔥"; }
.np-check[data-task="k"]::before { content: "🔑"; }
.np-check[data-task="w"]::before { content: "🏆"; }
.np-check[data-task="u"] { border-color: rgba(68, 131, 97, 1); color: rgba(68, 131, 97, 1); }
.np-check[data-task="u"]::before { content: "↑"; }
.np-check[data-task="d"] { border-color: rgba(212, 76, 71, 1); color: rgba(212, 76, 71, 1); }
.np-check[data-task="d"]::before { content: "↓"; }
.np-check[data-task="l"], .np-check[data-task="b"], .np-check[data-task="S"],
.np-check[data-task="I"], .np-check[data-task="p"], .np-check[data-task="c"],
.np-check[data-task="f"], .np-check[data-task="k"], .np-check[data-task="w"] {
  border: none;
  background: none;
  font-size: 1em;
}
/* Font Awesome checkbox icons (user-picked set 2026-07-04): the inline svg
   replaces the emoji/::before look for all 22 known states — bare glyph,
   currentColor inherits the per-state colors above. Unknown states keep the
   legacy fallback. These rules come LAST so they win the ties. */
.np-check.np-check-fa {
  border: none;
  background: none;
  font-size: 1em;
  width: 1.15em;
  height: 1.15em;
  top: 0.22em;
  overflow: visible;
  /* ALL task icons follow the (captured) accent color — user decision
     2026-07-04: "icon 顏色用 Obsidian 設定的 accent color" means every
     state, uniformly, like the links */
  color: var(--np-color-accent);
}
.np-check.np-check-fa::before {
  content: none;
}
.np-check.np-check-fa svg {
  /* glyph slightly smaller than its box — the right edge was getting
     shaved at some zoom levels (user screenshot 2026-07-04) */
  width: 0.95em;
  height: 0.95em;
  display: block;
}
li.task-list-item[data-task="x"],
li.task-list-item[data-task="-"] {
  color: var(--np-color-text-muted);
  text-decoration: line-through;
}
/* callouts (official 13 types + aliases; colors from the Notion palette) */
.np-note-content .callout {
  --np-callout: 51, 126, 169;
  background: rgba(var(--np-callout), 0.08);
  border-left: 3px solid rgb(var(--np-callout));
  border-radius: var(--np-radius);
  padding: var(--np-space-2) var(--np-space-3);
  margin: var(--np-space-2) 0;
  overflow: hidden;
}
.np-note-content .callout-title {
  display: flex;
  align-items: center;
  gap: var(--np-space-1);
  color: rgb(var(--np-callout));
  font-weight: 600;
}
.np-note-content .callout-icon {
  display: flex;
}
.np-note-content .callout-icon svg {
  width: 1.1em;
  height: 1.1em;
}
.np-note-content .callout-content {
  margin-top: var(--np-space-1);
}
.np-note-content .callout-content > p {
  margin: var(--np-space-1) 0;
}
.np-note-content .callout.is-collapsible .callout-title {
  cursor: pointer;
}
.np-note-content .callout-fold {
  display: flex;
  margin-left: auto;
}
.np-note-content .callout-fold svg {
  width: 1em;
  height: 1em;
  transition: transform 0.15s ease;
}
.np-note-content .callout.is-collapsed .callout-fold svg {
  transform: rotate(-90deg);
}
.np-note-content .callout.is-collapsed > .callout-content {
  display: none;
}
.callout[data-callout="abstract"], .callout[data-callout="summary"], .callout[data-callout="tldr"],
.callout[data-callout="info"], .callout[data-callout="todo"], .callout[data-callout="note"] {
  --np-callout: 51, 126, 169;
}
.callout[data-callout="tip"], .callout[data-callout="hint"], .callout[data-callout="important"],
.callout[data-callout="success"], .callout[data-callout="check"], .callout[data-callout="done"] {
  --np-callout: 68, 131, 97;
}
.callout[data-callout="question"], .callout[data-callout="help"], .callout[data-callout="faq"] {
  --np-callout: 203, 145, 47;
}
.callout[data-callout="warning"], .callout[data-callout="caution"], .callout[data-callout="attention"] {
  --np-callout: 217, 115, 13;
}
.callout[data-callout="failure"], .callout[data-callout="fail"], .callout[data-callout="missing"],
.callout[data-callout="danger"], .callout[data-callout="error"], .callout[data-callout="bug"] {
  --np-callout: 212, 76, 71;
}
.callout[data-callout="example"] {
  --np-callout: 144, 101, 176;
}
.callout[data-callout="quote"], .callout[data-callout="cite"] {
  --np-callout: 120, 119, 116;
}
/* syntax highlighting: Obsidian ships Prism token spans in the rendered DOM
   (2026-07-03 evidence) — they only need colors. Notion-palette based. */
.np-note-content .token.comment,
.np-note-content .token.prolog,
.np-note-content .token.cdata {
  color: rgba(120, 119, 116, 1);
  font-style: italic;
}
.np-note-content .token.keyword,
.np-note-content .token.control-flow,
.np-note-content .token.important,
.np-note-content .token.atrule {
  color: rgba(144, 101, 176, 1);
}
.np-note-content .token.function,
.np-note-content .token.function-name,
.np-note-content .token.selector,
.np-note-content .token.tag {
  color: rgba(51, 126, 169, 1);
}
.np-note-content .token.string,
.np-note-content .token.template-string,
.np-note-content .token.char,
.np-note-content .token.attr-value {
  color: rgba(68, 131, 97, 1);
}
.np-note-content .token.number,
.np-note-content .token.boolean,
.np-note-content .token.constant,
.np-note-content .token.symbol {
  color: rgba(217, 115, 13, 1);
}
.np-note-content .token.operator,
.np-note-content .token.punctuation {
  color: rgba(120, 119, 116, 1);
}
.np-note-content .token.parameter,
.np-note-content .token.property,
.np-note-content .token.attr-name,
.np-note-content .token.variable {
  color: rgba(203, 145, 47, 1);
}
.np-note-content .token.regex,
.np-note-content .token.url {
  color: rgba(193, 76, 138, 1);
}
/* summaries footer rows (per-group subtotal + overall total) */
.np-summary-row td {
  border-top: 2px solid var(--np-color-border-strong);
  background: var(--np-color-bg-subtle);
  font-weight: 600;
}
.np-sum-label {
  display: block;
  font-size: 0.75em;
  font-weight: 500;
  color: var(--np-color-text-muted);
}
/* our offline copy button (top-right, appears on hover) */
.np-copy {
  position: absolute;
  top: var(--np-space-2);
  right: var(--np-space-2);
  border: 1px solid var(--np-color-border);
  border-radius: var(--np-radius);
  background: var(--np-color-bg);
  color: var(--np-color-text-muted);
  font: inherit;
  font-size: var(--np-font-size-sm);
  padding: 4px;
  line-height: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s ease;
}
pre:hover .np-copy {
  opacity: 1;
}
.np-copy:hover {
  color: var(--np-color-text);
}
.np-note-content mark {
  background: rgba(251, 243, 219, 1);
  padding: 0 2px;
}
.np-note-content h2, .np-note-content h3 {
  margin: var(--np-space-3) 0 var(--np-space-2);
}
/* embedded NOTE (![[note]]): framed inline content with a title link */
.np-note-embed {
  border: 1px solid var(--np-color-border);
  border-left: 3px solid var(--np-color-border-strong);
  border-radius: var(--np-radius);
  padding: var(--np-space-2) var(--np-space-3);
  margin: var(--np-space-2) 0;
}
.np-note-embed-body {
  margin-top: var(--np-space-1);
}
/* base embedded in a note: caption + our semantic table.
   Breakout width (user req 2026-07-03): note text stays at reading width,
   the embedded base block widens toward the base-page width on big screens. */
.np-embedded-base {
  margin: var(--np-space-3) 0;
  /* 48px safety margin keeps the centered block clear of scrollbars */
  --np-breakout: min(var(--np-page-max-width-wide), calc(100vw - 48px));
  width: var(--np-breakout);
  margin-left: calc(50% - var(--np-breakout) / 2);
}
/* no room to break out on narrow screens — it only shoves content off-edge */
@media (max-width: 900px) {
  .np-embedded-base {
    width: auto;
    margin-left: 0;
  }
}
/* sidebar layout: breakout must span the AVAILABLE area, not 100vw —
   the old math shoved the block under the fixed sidebar and off the right
   edge (user screenshot 2026-07-04: left columns clipped) */
@media (min-width: 900px) {
  body.np-has-nav .np-embedded-base {
    --np-breakout: min(
      var(--np-page-max-width-wide),
      calc(100vw - var(--np-sidebar-width) - 48px)
    );
  }
}
/* list view */
.np-group-label {
  font-weight: 700;
  margin: var(--np-space-3) 0 var(--np-space-1);
}
.np-list {
  margin: var(--np-space-2) 0;
  padding-left: 1.5em;
}
.np-list li {
  margin: var(--np-space-1) 0;
}
.np-list-sub {
  font-size: var(--np-font-size-sm);
  color: var(--np-color-text-muted);
  margin-top: 1px;
}
.np-sub-prop {
  margin-right: var(--np-space-2);
}
.np-sub-label {
  opacity: 0.75;
  margin-right: 2px;
}
/* cards view */
.np-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: var(--np-space-2);
  margin: var(--np-space-2) 0;
}
.np-card {
  border: 1px solid var(--np-color-border);
  border-radius: var(--np-radius);
  padding: var(--np-space-2) var(--np-space-3);
  background: var(--np-color-bg);
  /* grid children default to min-width:auto and can burst the cell —
     clamp + wrap-anywhere so unbreakable tokens stay inside the card */
  min-width: 0;
  overflow-wrap: anywhere;
}
.np-card-title,
.np-list-sub,
.np-sub-prop {
  overflow-wrap: anywhere;
}
.np-card:hover {
  background: var(--np-color-bg-subtle);
}
.np-card-title {
  font-weight: 600;
  margin-bottom: var(--np-space-1);
}
/* cards stack properties like Obsidian: label line above value, one per row */
.np-card .np-sub-prop {
  display: block;
  margin: 0 0 var(--np-space-1);
}
.np-card .np-sub-label {
  display: block;
  font-size: 0.8em;
  opacity: 0.7;
}
.np-card-cover {
  /* default matches observed Obsidian cards; per-view imageAspectRatio
     overrides via inline style. May be an <a> (cover links to the note —
     bigger tap target, user req 2026-07-04). */
  display: block;
  aspect-ratio: 1 / 1;
  overflow: hidden;
  margin: calc(-1 * var(--np-space-2)) calc(-1 * var(--np-space-3)) var(--np-space-2);
  border-radius: var(--np-radius) var(--np-radius) 0 0;
  background: var(--np-color-bg-subtle);
}
.np-card-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
/* thin global header: HOME + offline search (sticky) */
.np-topbar {
  position: sticky;
  top: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  gap: var(--np-space-3);
  background: color-mix(in srgb, var(--np-color-bg) 92%, transparent);
  backdrop-filter: blur(6px);
  border-bottom: 1px solid var(--np-color-border);
  margin: 0 calc(-1 * var(--np-page-pad-x));
  padding: var(--np-space-1) var(--np-page-pad-x);
  font-size: var(--np-font-size-sm);
}
.np-home {
  color: var(--np-color-text-muted);
  white-space: nowrap;
}
.np-home:hover {
  color: var(--np-color-accent);
  text-decoration: none;
}
.np-search {
  position: relative;
  flex: 1;
  max-width: 420px;
  margin-left: auto;
}
.np-search-input {
  width: 100%;
  font: inherit;
  padding: 2px var(--np-space-2);
  border: 1px solid var(--np-color-border);
  border-radius: var(--np-radius);
  background: var(--np-color-bg);
  color: var(--np-color-text);
}
.np-search-input:focus {
  outline: none;
  border-color: var(--np-color-accent);
}
.np-search-results {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  left: 0;
  /* above the nav tree — rotated arrows form stacking contexts that would
     otherwise paint over the dropdown (user question 2026-07-04: yes) */
  z-index: 5;
  max-height: 60vh;
  overflow-y: auto;
  background: var(--np-color-bg);
  border: 1px solid var(--np-color-border);
  border-radius: var(--np-radius);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}
.np-search-hit {
  display: block;
  padding: var(--np-space-1) var(--np-space-2);
  border-bottom: 1px solid var(--np-color-border);
  color: var(--np-color-text);
}
.np-search-hit:hover {
  background: var(--np-color-bg-subtle);
  text-decoration: none;
}
.np-hit-t {
  font-weight: 600;
}
.np-hit-x {
  font-size: 0.85em;
  color: var(--np-color-text-muted);
  overflow-wrap: anywhere;
}
.np-search-none {
  padding: var(--np-space-1) var(--np-space-2);
  color: var(--np-color-text-muted);
}
/* START_HERE index sections (not part of the view switcher) */
section.np-start-sec {
  margin: var(--np-space-3) 0 var(--np-space-4);
}
/* base page: one section per named view */
section.np-view {
  margin: var(--np-space-3) 0 var(--np-space-4);
}
.np-view-title {
  font-size: 1.15em;
  font-weight: 700;
  margin: 0 0 var(--np-space-2);
  padding-bottom: var(--np-space-1);
  border-bottom: 1px solid var(--np-color-border);
}
/* view switcher tabs (Notion-style); section titles hide when tabs are live */
.np-view-tabs {
  display: flex;
  gap: var(--np-space-1);
  border-bottom: 1px solid var(--np-color-border);
  margin: var(--np-space-3) 0 0;
}
.np-view-tab {
  appearance: none;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  font: inherit;
  font-size: var(--np-font-size-sm);
  color: var(--np-color-text-muted);
  padding: var(--np-space-1) var(--np-space-2);
  cursor: pointer;
}
.np-view-tab:hover {
  color: var(--np-color-text);
  background: var(--np-color-bg-subtle);
  border-radius: var(--np-radius) var(--np-radius) 0 0;
}
.np-view-tab.np-active {
  color: var(--np-color-text);
  font-weight: 600;
  border-bottom-color: var(--np-color-text);
}
body.np-tabs-on .np-view-title {
  display: none;
}
body.np-tabs-on section.np-view {
  margin-top: var(--np-space-3);
}
.np-embed-caption {
  font-size: var(--np-font-size-sm);
  color: var(--np-color-text-muted);
  margin-bottom: var(--np-space-1);
}
.np-embed-caption-link {
  color: var(--np-color-text-muted);
}
.np-embed-caption-link:hover {
  color: var(--np-color-accent);
}
/* heading fold: arrow hangs BEFORE the heading (Obsidian/Notion style),
   appears on hover; folded section hides its body */
.np-hsec-heading {
  position: relative;
}
.np-fold-btn {
  position: absolute;
  left: -1.2em;
  top: 50%;
  transform: translateY(-50%);
  color: var(--np-color-text-muted);
  font-size: 0.75em;
  line-height: 1;
  cursor: pointer;
  opacity: 0;
  transition: transform 0.15s ease, opacity 0.15s ease;
  user-select: none;
  padding: 4px;
}
.np-hsec-heading:hover .np-fold-btn,
.np-hsec.np-folded .np-fold-btn {
  opacity: 1;
}
.np-hsec.np-folded > .np-hsec-body {
  display: none;
}
.np-hsec.np-folded .np-hsec-heading .np-fold-btn {
  transform: translateY(-50%) rotate(-90deg);
}
body.np-wide {
  max-width: var(--np-page-max-width-wide);
}
/* Wide tables scroll sideways instead of squeezing columns into slivers. */
.np-table-wrap {
  overflow-x: auto;
}
table.np-table {
  border-collapse: collapse;
  width: 100%;
  font-size: 0.9375em;
}
.np-table th, .np-table td {
  border: 1px solid var(--np-color-border);
  padding: var(--np-space-2) var(--np-space-2);
  text-align: left;
  vertical-align: top;
  /* Notion-style: never truncate — wrap and let the row grow taller. */
  overflow-wrap: anywhere;
  min-width: var(--np-table-col-min);
}
.np-table th {
  background: var(--np-color-bg-subtle);
  color: var(--np-color-text-muted);
  font-weight: 500;
  font-size: var(--np-font-size-sm);
}
.np-table tr:hover td {
  background: var(--np-color-bg-subtle);
}
/* groupBy section header: Notion-style bold divider row */
.np-table .np-group-header th {
  background: var(--np-color-bg);
  color: var(--np-color-text);
  font-size: 1em;
  font-weight: 700;
  border-left: none;
  border-right: none;
  border-top: none;
  border-bottom: 2px solid var(--np-color-border);
  padding-top: var(--np-space-3);
}
.np-error {
  background: var(--np-color-error-bg);
  color: var(--np-color-error-text);
  border: 1px solid var(--np-color-error-text);
  border-radius: var(--np-radius);
  padding: var(--np-space-3);
  margin: var(--np-space-3) 0;
}
.np-error h2 { margin: 0 0 var(--np-space-2); font-size: 1em; }
footer.np-footer {
  margin-top: var(--np-space-4);
  font-size: var(--np-font-size-sm);
  color: var(--np-color-text-muted);
}
/* ===== mobile (user-approved stacked-row table pattern, pure CSS) ===== */
@media (max-width: 640px) {
  body {
    --np-page-pad-x: var(--np-space-2);
    padding: var(--np-space-3) var(--np-page-pad-x);
  }
  .np-view-tabs {
    flex-wrap: wrap;
  }
  /* tables: hide the header row; each row becomes a bordered card and every
     cell shows its column name above the value via data-label */
  .np-table thead {
    display: none;
  }
  .np-table,
  .np-table tbody,
  .np-table tr,
  .np-table td {
    display: block;
    width: 100%;
  }
  .np-table td {
    border: none;
    border-bottom: 1px solid var(--np-color-border);
    min-width: 0;
    padding: var(--np-space-1) var(--np-space-2);
  }
  .np-table td:last-child {
    border-bottom: none;
  }
  .np-table td::before {
    content: attr(data-label);
    display: block;
    font-size: 0.8em;
    color: var(--np-color-text-muted);
  }
  .np-table td:empty {
    display: none;
  }
  /* clearer record separation on phones (user feedback 2026-07-03) */
  .np-table tr {
    border: 1.5px solid var(--np-color-border-strong);
    border-radius: var(--np-radius);
    margin: var(--np-space-3) 0;
    background: var(--np-color-bg);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
    overflow: hidden; /* clip hover backgrounds to the rounded frame */
  }
  .np-table-wrap {
    overflow-x: visible;
  }
  /* phone cards: two columns (overrides desktop cardSize inline style) */
  .np-cards {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    gap: var(--np-space-2);
  }
  .np-table .np-group-header,
  .np-table .np-group-header th {
    display: block;
    border: none;
    background: none;
    padding: var(--np-space-2) 0 0;
  }
}
/* ── Publish-style left sidebar: title + search + folder/file tree ─────── */
.np-sidebar {
  position: fixed;
  top: 0;
  bottom: 0;
  left: 0;
  width: var(--np-sidebar-width);
  background: var(--np-color-bg-subtle);
  border-right: 1px solid var(--np-color-border);
  padding: var(--np-space-3);
  overflow-y: auto;
  z-index: 90;
}
.np-side-title {
  font-weight: 700;
  margin-bottom: var(--np-space-3);
  overflow-wrap: anywhere;
}
.np-side-title a {
  color: var(--np-color-text);
}
.np-sidebar .np-search {
  max-width: none;
  margin: 0 0 var(--np-space-3);
}
.np-nav-tree {
  font-size: var(--np-font-size-sm);
}
.np-nav-item {
  display: flex;
  align-items: center;
  gap: var(--np-space-1);
  color: var(--np-color-text-muted);
  padding: 2px var(--np-space-1);
  border-radius: var(--np-radius);
  overflow-wrap: anywhere;
}
.np-nav-label {
  flex: 1 1 auto;
  min-width: 0;
}
/* Obsidian-style file-type chip on base pages (user req 2026-07-04) */
.np-nav-tag {
  flex: none;
  margin-left: auto;
  font-size: 0.7em;
  letter-spacing: 0.04em;
  line-height: 1.5;
  color: var(--np-color-text-muted);
  border: 1px solid var(--np-color-border-strong);
  border-radius: var(--np-radius);
  padding: 0 var(--np-space-1);
}
.np-nav-item:hover {
  background: var(--np-color-border);
  color: var(--np-color-text);
  text-decoration: none;
}
.np-nav-item.np-current {
  color: var(--np-color-accent);
  font-weight: 600;
}
.np-nav-folder > button {
  display: flex;
  align-items: center;
  gap: var(--np-space-1);
  width: 100%;
  background: none;
  border: 0;
  font: inherit;
  font-weight: 600;
  color: var(--np-color-text);
  cursor: pointer;
  padding: 2px var(--np-space-1);
  text-align: left;
}
.np-nav-arrow {
  /* 1.5x + flex-centered (user feedback 2026-07-04: too small, sat high) */
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1em;
  font-size: 1.5em;
  line-height: 1;
  color: var(--np-color-text-muted);
  transition: transform 0.12s;
}
.np-nav-folder.np-open > button .np-nav-arrow {
  transform: rotate(90deg);
}
.np-nav-children {
  display: none;
  padding-left: var(--np-space-3);
}
.np-nav-folder.np-open > .np-nav-children {
  display: block;
}
.np-nav-btn {
  display: none;
  background: none;
  border: 0;
  font-size: 1.1em;
  color: var(--np-color-text);
  cursor: pointer;
  padding: 0 var(--np-space-1);
}
.np-backdrop {
  display: none;
}
/* desktop: persistent sidebar, content centered in the remaining space;
   the thin topbar is redundant there (sidebar owns home + search) */
@media (min-width: 900px) {
  body.np-has-nav {
    max-width: none;
    margin: 0 0 0 var(--np-sidebar-width);
    padding-left: max(
      var(--np-space-3),
      calc((100vw - var(--np-sidebar-width) - var(--np-page-max-width)) / 2)
    );
    padding-right: max(
      var(--np-space-3),
      calc((100vw - var(--np-sidebar-width) - var(--np-page-max-width)) / 2)
    );
  }
  body.np-has-nav.np-wide {
    padding-left: var(--np-space-3);
    padding-right: var(--np-space-3);
  }
  body.np-has-nav .np-topbar {
    display: none;
  }
}
/* mobile: off-canvas drawer behind the menu button (user req: menu icon) */
@media (max-width: 899.98px) {
  .np-sidebar {
    transform: translateX(-100%);
    transition: transform 0.15s ease;
  }
  body.np-nav-open .np-sidebar {
    transform: none;
  }
  .np-nav-btn {
    display: inline-block;
  }
  body.np-nav-open .np-backdrop {
    display: block;
    position: fixed;
    inset: 0;
    background: var(--np-color-backdrop);
    z-index: 80;
  }
}
`;

/**
 * Password-gate pages (login / self-check), generated into index.php.
 * Same single design source as every other output: tokens only — no raw
 * values (REQUIREMENTS scope fix 2026-07-04: ALL visual output is
 * token+template based, gate pages included). The gate cannot load
 * _notepack/theme.css (it lives behind the auth wall), so TOKENS_CSS +
 * this template are inlined at generation time.
 */
export const GATE_PAGE_CSS = `
*, *::before, *::after {
  box-sizing: border-box;
}
body.np-gate {
  font-family: var(--np-font-family);
  font-size: var(--np-font-size);
  line-height: var(--np-line-height);
  color: var(--np-color-text);
  background: var(--np-color-bg-subtle);
  display: flex;
  min-height: 100vh;
  align-items: center;
  justify-content: center;
  margin: 0;
}
.np-card {
  background: var(--np-color-bg);
  border: 1px solid var(--np-color-border);
  border-radius: var(--np-radius);
  padding: var(--np-space-4);
  max-width: 26rem;
  width: calc(100% - var(--np-space-4) - var(--np-space-4));
}
.np-card h1 {
  font-size: 1.15em;
  font-weight: 700;
  margin: 0 0 var(--np-space-3);
}
.np-card a {
  color: var(--np-color-accent);
  text-decoration: none;
}
.np-card a:hover {
  text-decoration: underline;
}
.np-card input[type="password"] {
  width: 100%;
  font-family: var(--np-font-family);
  font-size: var(--np-font-size);
  padding: var(--np-space-2);
  border: 1px solid var(--np-color-border-strong);
  border-radius: var(--np-radius);
  margin: var(--np-space-1) 0 var(--np-space-3);
}
.np-card button {
  background: var(--np-color-accent);
  color: var(--np-color-bg);
  border: 0;
  border-radius: var(--np-radius);
  padding: var(--np-space-2) var(--np-space-3);
  font-family: var(--np-font-family);
  font-size: var(--np-font-size-sm);
  cursor: pointer;
}
label.np-remember {
  display: block;
  font-size: var(--np-font-size-sm);
  color: var(--np-color-text-muted);
  margin: 0 0 var(--np-space-3);
}
.np-err {
  color: var(--np-color-error-text);
  background: var(--np-color-error-bg);
  border-radius: var(--np-radius);
  padding: var(--np-space-1) var(--np-space-2);
  font-size: var(--np-font-size-sm);
  margin: 0 0 var(--np-space-2);
}
.np-foot {
  margin-top: var(--np-space-3);
  font-size: var(--np-font-size-sm);
  color: var(--np-color-text-muted);
}
.np-foot a {
  color: var(--np-color-text-muted);
}
.np-card ul {
  padding-left: var(--np-space-3);
  margin: var(--np-space-2) 0;
}
.np-card li {
  margin: var(--np-space-1) 0;
}
.np-ok {
  color: var(--np-color-accent);
}
.np-bad {
  color: var(--np-color-error-text);
  font-weight: 600;
}
`;

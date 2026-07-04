/**
 * Publish-style left sidebar (user req 2026-07-04): package title + the
 * offline search box + a collapsible folder/file tree. Only the sidebar and
 * search come from the Publish reference — content styling stays ours.
 * Ships as classic scripts (file:// blocks fetch, same rule as search).
 */

export interface NavEntry {
	/** vault path (folder grouping source), e.g. "books/礼记.md" */
	path: string;
	/** human title shown in the tree */
	title: string;
	/** url relative to the package root, e.g. "notes/note-xxxx.html" */
	url: string;
	/** base pages get an Obsidian-style small BASE tag (user req 2026-07-04) */
	kind: "note" | "base";
}

interface NavFolder {
	t: string;
	c: NavNode[];
}
interface NavFile {
	t: string;
	u: string;
	/** 1 = base page (renders the BASE tag) */
	b?: 1;
}
type NavNode = NavFolder | NavFile;

/** Nested tree from vault paths; folders first, then files, both alpha.
 * folderPaths seeds the REAL folder structure (empty folders included —
 * sidebar mirrors Obsidian's explorer, user req 2026-07-04). */
function buildTree(entries: NavEntry[], folderPaths: string[]): NavNode[] {
	interface Dir {
		files: NavFile[];
		dirs: Map<string, Dir>;
	}
	const root: Dir = { files: [], dirs: new Map() };
	for (const p of folderPaths) {
		let cur = root;
		for (const s of p.split("/")) {
			let next = cur.dirs.get(s);
			if (next === undefined) {
				next = { files: [], dirs: new Map() };
				cur.dirs.set(s, next);
			}
			cur = next;
		}
	}
	for (const e of entries) {
		const segs = e.path.split("/");
		segs.pop(); // drop the filename — grouping uses folders only
		let cur = root;
		for (const s of segs) {
			let next = cur.dirs.get(s);
			if (next === undefined) {
				next = { files: [], dirs: new Map() };
				cur.dirs.set(s, next);
			}
			cur = next;
		}
		cur.files.push(
			e.kind === "base"
				? { t: e.title, u: e.url, b: 1 }
				: { t: e.title, u: e.url },
		);
	}
	const toNodes = (d: Dir): NavNode[] => {
		const folders = [...d.dirs.entries()]
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([name, sub]): NavNode => ({ t: name, c: toNodes(sub) }));
		const files = d.files.sort((a, b) => a.t.localeCompare(b.t));
		return [...folders, ...files];
	};
	return toNodes(root);
}

export function buildNavIndexJs(
	title: string,
	entries: NavEntry[],
	folderPaths: string[] = [],
): string {
	return `window.NP_NAV=${JSON.stringify({ title, tree: buildTree(entries, folderPaths) })};\n`;
}

/** Sidebar renderer: tree + current-page highlight + mobile drawer toggle. */
export const NAV_JS = `(function () {
  var host = document.querySelector(".np-nav-tree");
  if (!host || !window.NP_NAV) return;
  var root = document.body.getAttribute("data-np-root") || "";
  var current = document.body.getAttribute("data-np-page") || "";
  function render(nodes, parent) {
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (n.c) {
        var wrap = document.createElement("div");
        wrap.className = "np-nav-folder";
        var btn = document.createElement("button");
        btn.type = "button";
        var arrow = document.createElement("span");
        arrow.className = "np-nav-arrow";
        arrow.textContent = "\\u25B8";
        btn.appendChild(arrow);
        btn.appendChild(document.createTextNode(n.t));
        btn.addEventListener("click", function (ev) {
          var f = ev.currentTarget.parentNode;
          f.className = f.className.indexOf("np-open") >= 0
            ? f.className.replace(/ ?np-open/, "")
            : f.className + " np-open";
        });
        var kids = document.createElement("div");
        kids.className = "np-nav-children";
        render(n.c, kids);
        wrap.appendChild(btn);
        wrap.appendChild(kids);
        parent.appendChild(wrap);
      } else {
        var a = document.createElement("a");
        a.className = "np-nav-item";
        a.href = root + n.u;
        var label = document.createElement("span");
        label.className = "np-nav-label";
        label.textContent = n.t;
        a.appendChild(label);
        if (n.b) {
          // Obsidian-style file-type chip so base pages stand out
          var tag = document.createElement("span");
          tag.className = "np-nav-tag";
          tag.textContent = "BASE";
          a.appendChild(tag);
        }
        if (n.u === current) {
          a.className += " np-current";
          // expand every ancestor folder so the current page is visible
          var p = parent;
          while (p && p !== host) {
            if (p.className && p.className.indexOf("np-nav-folder") >= 0 &&
                p.className.indexOf("np-open") < 0) {
              p.className += " np-open";
            }
            p = p.parentNode;
          }
        }
        parent.appendChild(a);
      }
    }
  }
  render(NP_NAV.tree, host);
  // walk np-nav-children ancestors too (folders wrap children in a div)
  var cur = host.querySelector(".np-current");
  if (cur) {
    var p = cur.parentNode;
    while (p && p !== host) {
      if (p.className && p.className.indexOf("np-nav-folder") >= 0 &&
          p.className.indexOf("np-open") < 0) {
        p.className += " np-open";
      }
      p = p.parentNode;
    }
  }
  // mobile drawer
  var btn = document.querySelector(".np-nav-btn");
  if (btn) {
    btn.addEventListener("click", function () {
      document.body.classList.toggle("np-nav-open");
    });
  }
  var backdrop = document.querySelector(".np-backdrop");
  if (backdrop) {
    backdrop.addEventListener("click", function () {
      document.body.classList.remove("np-nav-open");
    });
  }
})();
`;

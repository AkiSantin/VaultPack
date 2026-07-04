import { App, FuzzySuggestModal, Modal, Setting } from "obsidian";
import { resolveLocale } from "./i18n";
import { UiKey, uiT } from "./ui-i18n";
import { DEFAULT_SETTINGS, VaultPackSettings } from "./settings";

/**
 * Export modes (docs/20260703-1738-web-sharing-security-requirements.md §2):
 * two local modes + three web-package modes. Every export now carries a
 * ModePlan; "local" reproduces the previously-accepted behavior exactly.
 */
export type ExportMode =
	| "local"
	| "zip"
	| "public"
	| "link-only"
	| "password";

export interface ModePlan {
	mode: ExportMode;
	/** high-entropy token for web folder naming / private subdir (spec §3.1) */
	token: string | null;
	/** export folder name under "VaultPack Exports/" (null → timestamp default) */
	exactFolderName: string | null;
	/** write _notepack diagnostics (url-map/report/…)? web modes: off (§3.2) */
	diagnostics: boolean;
	/** per-page <meta name="robots" noindex…> (§4.2) */
	noindexMeta: boolean;
	/** per-page <meta name="referrer" content="no-referrer"> (§4.2) */
	noReferrerMeta: boolean;
	/** upgrade external links to rel="noopener noreferrer" (§4.2) */
	relNoreferrer: boolean;
	/** which root .htaccess to emit */
	htaccess: "public" | "link-only" | "password" | null;
	/** password mode: package content nests inside this subdir (§5.1) */
	privateSubdir: string | null;
	/** pack the finished folder into an AES-encrypted .zip afterwards (§2.1) */
	zipAfter: boolean;
	/** user password (zip / password modes) — never written to any output */
	password: string | null;
	/** password mode: "remember on this device" lifetime in days (§5.5) */
	rememberDays: number;
}

/** Base58-ish alphabet (no 0/O/I/l) — URL-safe, unambiguous to read aloud. */
const TOKEN_ALPHABET =
	"123456789ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz";

/** High-entropy token via Web Crypto (spec §3.1: unguessable entry path). */
export function randomToken(len = 16): string {
	const buf = new Uint32Array(len);
	crypto.getRandomValues(buf);
	let out = "";
	for (let i = 0; i < len; i++) {
		out += TOKEN_ALPHABET[buf[i] % TOKEN_ALPHABET.length];
	}
	return out;
}

export function makeModePlan(
	mode: ExportMode,
	password: string | null = null,
	settings: VaultPackSettings = DEFAULT_SETTINGS,
): ModePlan {
	const webDiag = settings.includeDiagnosticsWeb;
	const entropy = settings.highEntropyFolderName;
	const rememberDays = settings.rememberDays;
	switch (mode) {
		case "local":
			return {
				mode,
				token: null,
				exactFolderName: null,
				diagnostics: true,
				noindexMeta: false,
				noReferrerMeta: false,
				relNoreferrer: false,
				htaccess: null,
				privateSubdir: null,
				zipAfter: false,
				password: null,
				rememberDays,
			};
		case "zip":
			return {
				mode,
				token: null,
				exactFolderName: null,
				diagnostics: true,
				noindexMeta: false,
				noReferrerMeta: false,
				relNoreferrer: false,
				htaccess: null,
				privateSubdir: null,
				zipAfter: true,
				password,
				rememberDays,
			};
		case "public":
			return {
				mode,
				token: null,
				exactFolderName: null,
				diagnostics: webDiag,
				noindexMeta: false,
				noReferrerMeta: false,
				relNoreferrer: false,
				htaccess: "public",
				privateSubdir: null,
				zipAfter: false,
				password: null,
				rememberDays,
			};
		case "link-only": {
			const token = randomToken();
			return {
				mode,
				token,
				exactFolderName: entropy ? `vaultpack-s-${token}` : null,
				diagnostics: webDiag,
				noindexMeta: true,
				noReferrerMeta: true,
				relNoreferrer: true,
				htaccess: "link-only",
				privateSubdir: null,
				zipAfter: false,
				password: null,
				rememberDays,
			};
		}
		case "password": {
			const token = randomToken();
			return {
				mode,
				token,
				exactFolderName: entropy ? `vaultpack-p-${token}` : null,
				diagnostics: webDiag,
				noindexMeta: true,
				noReferrerMeta: true,
				relNoreferrer: true,
				htaccess: "password",
				privateSubdir: `_np_private_${token}`,
				zipAfter: false,
				password,
				rememberDays,
			};
		}
	}
}

interface ModeChoice {
	id: ExportMode;
	labelKey: UiKey;
	needsPassword: boolean;
}

/** One short sentence per mode — spec §7.2 required explanatory copy. */
const MODE_CHOICES: ModeChoice[] = [
	{ id: "local", labelKey: "modeLocal", needsPassword: false },
	{ id: "zip", labelKey: "modeZip", needsPassword: true },
	{ id: "public", labelKey: "modePublic", needsPassword: false },
	{ id: "link-only", labelKey: "modeLinkOnly", needsPassword: false },
	{ id: "password", labelKey: "modePassword", needsPassword: true },
];

/** Step 2 of the export flow (after scope): pick the output mode. */
export class ModePickerModal extends FuzzySuggestModal<ModeChoice> {
	private readonly locale = resolveLocale();
	constructor(
		app: App,
		private readonly settings: VaultPackSettings,
		private readonly onPick: (plan: ModePlan | null) => void,
	) {
		super(app);
		this.setPlaceholder(uiT(this.locale, "modePickerPlaceholder"));
	}
	getItems(): ModeChoice[] {
		return MODE_CHOICES;
	}
	getItemText(item: ModeChoice): string {
		return uiT(this.locale, item.labelKey);
	}
	onChooseItem(item: ModeChoice): void {
		if (!item.needsPassword) {
			this.onPick(makeModePlan(item.id, null, this.settings));
			return;
		}
		new PasswordPromptModal(this.app, (pw) => {
			this.onPick(
				pw !== null ? makeModePlan(item.id, pw, this.settings) : null,
			);
		}).open();
	}
}

/**
 * Custom package title (user req 2026-07-04): shown in the sidebar, on
 * START_HERE and in <title>. Empty / "use default" → the scope's default
 * (vault name / folder path / base name). Esc cancels the export.
 */
export class TitlePromptModal extends Modal {
	private value = "";
	constructor(
		app: App,
		private readonly defaultTitle: string,
		private readonly onDone: (title: string | null) => void,
	) {
		super(app);
	}
	onOpen(): void {
		let done = false;
		const locale = resolveLocale();
		const submit = (v: string): void => {
			done = true;
			this.close();
			this.onDone(v.trim() !== "" ? v.trim() : this.defaultTitle);
		};
		this.titleEl.setText(uiT(locale, "titleTitle"));
		new Setting(this.contentEl)
			.setName(uiT(locale, "titleLabel"))
			.addText((t) => {
				t.setPlaceholder(this.defaultTitle);
				t.onChange((v) => {
					this.value = v;
				});
				t.inputEl.addEventListener("keydown", (ev) => {
					if (ev.key === "Enter") {
						submit(this.value);
					}
				});
			});
		new Setting(this.contentEl)
			.addButton((b) =>
				b
					.setButtonText(uiT(locale, "titleOk"))
					.setCta()
					.onClick(() => {
						submit(this.value);
					}),
			)
			.addButton((b) =>
				b.setButtonText(uiT(locale, "titleSkip")).onClick(() => {
					submit("");
				}),
			);
		this.onClose = () => {
			this.contentEl.empty();
			if (!done) {
				this.onDone(null);
			}
		};
	}
}

/**
 * Password entry for zip / password modes. The password lives only in memory
 * for this export run — never persisted, never written into the package
 * (only its bcrypt hash reaches the PHP gate; the ZIP stores AES material).
 */
export class PasswordPromptModal extends Modal {
	private pw = "";
	private pw2 = "";
	constructor(
		app: App,
		private readonly onDone: (password: string | null) => void,
	) {
		super(app);
	}
	onOpen(): void {
		let done = false;
		const locale = resolveLocale();
		this.titleEl.setText(uiT(locale, "pwTitle"));
		new Setting(this.contentEl)
			.setName(uiT(locale, "pwLabel"))
			.addText((t) => {
				t.inputEl.type = "password";
				t.onChange((v) => {
					this.pw = v;
				});
			});
		new Setting(this.contentEl)
			.setName(uiT(locale, "pwConfirmLabel"))
			.addText((t) => {
				t.inputEl.type = "password";
				t.onChange((v) => {
					this.pw2 = v;
				});
			});
		const err = this.contentEl.createDiv({ cls: "np-modal-error" });
		new Setting(this.contentEl)
			.addButton((b) =>
				b
					.setButtonText(uiT(locale, "pwOk"))
					.setCta()
					.onClick(() => {
						if (this.pw.length < 4) {
							err.setText(uiT(locale, "pwTooShort"));
							return;
						}
						if (this.pw !== this.pw2) {
							err.setText(uiT(locale, "pwMismatch"));
							return;
						}
						done = true;
						const pw = this.pw;
						this.close();
						this.onDone(pw);
					}),
			)
			.addButton((b) =>
				b.setButtonText(uiT(locale, "pwCancel")).onClick(() => {
					this.close();
				}),
			);
		this.onClose = () => {
			this.contentEl.empty();
			if (!done) {
				this.onDone(null);
			}
		};
	}
}

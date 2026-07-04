import { App, PluginSettingTab, Setting } from "obsidian";
import { resolveLocale, t } from "./i18n";
import type VaultPackPlugin from "./main";

/**
 * Plugin settings (spec §7.3 Advanced Settings). Defaults mirror the spec:
 * high-entropy folder names ON for web link-only/password, diagnostics OFF
 * for web packages, session = browser with a 30-day "remember" option.
 * UI language follows the Obsidian app language (user req 2026-07-04):
 * zh-TW / EN / JA via resolveLocale, anything else falls back to EN —
 * the same rule the exported pages use.
 */
export interface VaultPackSettings {
	/** ship _notepack diagnostics (url-map/report/…) in WEB packages */
	includeDiagnosticsWeb: boolean;
	/** vaultpack-s/p-<token> folder names for link-only/password exports */
	highEntropyFolderName: boolean;
	/** password mode: "remember on this device" session lifetime (days) */
	rememberDays: number;
	/** show developer commands (test page / probe / five-mode matrix) */
	developerMode: boolean;
}

export const DEFAULT_SETTINGS: VaultPackSettings = {
	includeDiagnosticsWeb: false,
	highEntropyFolderName: true,
	rememberDays: 30,
	developerMode: false,
};

export class VaultPackSettingTab extends PluginSettingTab {
	constructor(
		app: App,
		private readonly plugin: VaultPackPlugin,
	) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		const locale = resolveLocale();
		containerEl.empty();

		new Setting(containerEl)
			.setName(t(locale, "settingsDiagName"))
			.setDesc(t(locale, "settingsDiagDesc"))
			.addToggle((tg) =>
				tg
					.setValue(this.plugin.settings.includeDiagnosticsWeb)
					.onChange(async (v) => {
						this.plugin.settings.includeDiagnosticsWeb = v;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName(t(locale, "settingsEntropyName"))
			.setDesc(t(locale, "settingsEntropyDesc"))
			.addToggle((tg) =>
				tg
					.setValue(this.plugin.settings.highEntropyFolderName)
					.onChange(async (v) => {
						this.plugin.settings.highEntropyFolderName = v;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName(t(locale, "settingsDevName"))
			.setDesc(t(locale, "settingsDevDesc"))
			.addToggle((tg) =>
				tg
					.setValue(this.plugin.settings.developerMode)
					.onChange(async (v) => {
						this.plugin.settings.developerMode = v;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName(t(locale, "settingsRememberName"))
			.setDesc(t(locale, "settingsRememberDesc"))
			.addText((tx) => {
				tx.inputEl.type = "number";
				tx.setValue(String(this.plugin.settings.rememberDays)).onChange(
					async (v) => {
						const n = Math.round(Number(v));
						if (Number.isFinite(n) && n >= 1 && n <= 365) {
							this.plugin.settings.rememberDays = n;
							await this.plugin.saveSettings();
						}
					},
				);
			});
	}
}

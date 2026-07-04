import { Notice, Plugin, TFile, TFolder } from "obsidian";
import {
	ScopeInput,
	exportActiveNote,
	exportAllBases,
	exportScoped,
} from "./base-export";
import {
	ExportMode,
	ModePickerModal,
	ModePlan,
	TitlePromptModal,
	makeModePlan,
} from "./export-mode";
import {
	ExportScope,
	ScopePickerModal,
	basesEmbeddedInNotes,
	basesUnderFolder,
	foldersUnder,
	mergeBases,
	notesUnderFolder,
} from "./scope";
import { runHelloExport } from "./hello-export";
import { runBasesProbe } from "./probe-bases";
import { NpLocale, resolveLocale } from "./i18n";
import { uiT } from "./ui-i18n";
import {
	DEFAULT_SETTINGS,
	VaultPackSettingTab,
	VaultPackSettings,
} from "./settings";

/**
 * VaultPack v2 — plugin surface.
 * Export flow: scope → output mode (spec §7.1) → custom title (user req
 * 2026-07-04; empty = default) → export. ALL user-visible text follows the
 * Obsidian app language (zh-TW/EN/JA, else EN) — REQUIREMENTS v1.11 scope.
 */
export default class VaultPackPlugin extends Plugin {
	settings: VaultPackSettings = { ...DEFAULT_SETTINGS };
	private locale: NpLocale = "en";

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	async onload(): Promise<void> {
		this.locale = resolveLocale();
		const L = (key: Parameters<typeof uiT>[1]) => uiT(this.locale, key);
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<VaultPackSettings> | null,
		);
		this.addSettingTab(new VaultPackSettingTab(this.app, this));
		this.addRibbonIcon("package", L("ribbonExport"), () => {
			this.pickScopeThenMode();
		});
		this.addCommand({
			id: "export-pick-scope",
			name: L("cmdPickScope"),
			callback: () => {
				this.pickScopeThenMode();
			},
		});
		this.addCommand({
			id: "export-first-base",
			name: L("cmdAllBases"),
			callback: () => {
				this.pickModeAndTitle(this.app.vault.getName(), (plan, title) =>
					void this.runBaseExport(plan, title),
				);
			},
		});
		this.addCommand({
			id: "export-active-note",
			name: L("cmdActiveNote"),
			callback: () => {
				this.pickMode((plan) => void this.runActiveNoteExport(undefined, plan));
			},
		});
		// developer commands hide behind the settings toggle (marketplace
		// hygiene, user decision 2026-07-04); reload applies the change
		if (this.settings.developerMode) {
			this.addCommand({
				id: "export-test-page",
				name: L("cmdTestPage"),
				callback: () => {
					void this.runExport();
				},
			});
			this.addCommand({
				id: "probe-bases",
				name: L("cmdProbe"),
				callback: () => {
					void this.runProbe();
				},
			});
			// dev self-verification: one click → all five modes over books/
			this.addCommand({
				id: "export-matrix-books",
				name: L("cmdMatrix"),
				callback: () => {
					void this.runMatrixExport();
				},
			});
		}
		// context menus: folder right-click / note・base "…" menu (user req)
		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file) => {
				if (file instanceof TFolder) {
					menu.addItem((item) =>
						item
							.setTitle(L("menuExportFolder"))
							.setIcon("package")
							.onClick(() =>
								this.pickModeAndTitle(
									file.path === "/" ? this.app.vault.getName() : file.path,
									(plan, title) =>
										void this.runScopedExport(
											{ kind: "folder", folder: file },
											plan,
											title,
										),
								),
							),
					);
				} else if (file instanceof TFile && file.extension === "md") {
					menu.addItem((item) =>
						item
							.setTitle(L("menuExportNote"))
							.setIcon("package")
							.onClick(() =>
								this.pickMode((plan) =>
									void this.runActiveNoteExport(file, plan),
								),
							),
					);
				} else if (file instanceof TFile && file.extension === "base") {
					menu.addItem((item) =>
						item
							.setTitle(L("menuExportBase"))
							.setIcon("package")
							.onClick(() =>
								this.pickModeAndTitle(file.basename, (plan, title) =>
									void this.runScopedExport(
										{ kind: "base", base: file },
										plan,
										title,
									),
								),
							),
					);
				}
			}),
		);
	}

	/**
	 * Folder scope = notes in the folder + bases in the folder + bases those
	 * notes EMBED (shared bases live centrally in real vaults — a folder
	 * export must follow references or it never ships base pages;
	 * user report 2026-07-04).
	 */
	private folderInput(folder: TFolder, customTitle?: string): ScopeInput {
		const extraNotes = notesUnderFolder(this.app, folder);
		return {
			title:
				customTitle ??
				(folder.path === "/" ? this.app.vault.getName() : folder.path),
			baseFiles: mergeBases(
				basesUnderFolder(this.app, folder),
				basesEmbeddedInNotes(this.app, extraNotes),
			),
			extraNotes,
			// real folder structure → sidebar shows empty folders too
			folderPaths: foldersUnder(this.app, folder),
		};
	}

	/** default package title for a scope (custom-title modal placeholder) */
	private scopeDefaultTitle(scope: ExportScope): string {
		switch (scope.kind) {
			case "vault":
			case "all-bases":
			case "active-note":
				return this.app.vault.getName();
			case "folder":
				return scope.folder.path === "/"
					? this.app.vault.getName()
					: scope.folder.path;
			case "base":
				return scope.base.basename;
		}
	}

	private pickScopeThenMode(): void {
		new ScopePickerModal(this.app, (scope) => {
			if (scope === null) {
				return;
			}
			if (scope.kind === "active-note") {
				// single-note quick path: no sidebar/title in that package
				this.pickMode((plan) => void this.runActiveNoteExport(undefined, plan));
				return;
			}
			this.pickModeAndTitle(this.scopeDefaultTitle(scope), (plan, title) =>
				void this.runScopedExport(scope, plan, title),
			);
		}).open();
	}

	private pickMode(run: (plan: ModePlan) => void): void {
		new ModePickerModal(this.app, this.settings, (plan) => {
			if (plan !== null) {
				run(plan);
			}
		}).open();
	}

	private pickModeAndTitle(
		defaultTitle: string,
		run: (plan: ModePlan, title: string) => void,
	): void {
		new ModePickerModal(this.app, this.settings, (plan) => {
			if (plan === null) {
				return;
			}
			new TitlePromptModal(this.app, defaultTitle, (title) => {
				if (title !== null) {
					run(plan, title);
				}
			}).open();
		}).open();
	}

	/** mode-specific tail for the completion Notice (upload hints, zip note) */
	private modeNoticeLines(
		plan: ModePlan,
		exportFolder: string,
		zipPath: string | null,
	): string {
		const lines: string[] = [];
		if (plan.mode === "zip" && zipPath !== null) {
			lines.push(
				uiT(this.locale, "zipNotice", { path: zipPath }),
				uiT(this.locale, "zipCompat"),
			);
		}
		if (plan.mode === "link-only") {
			lines.push(
				uiT(this.locale, "linkOnlyHint", {
					folder: exportFolder.split("/").pop() ?? "",
				}),
			);
		}
		if (plan.mode === "password") {
			lines.push(uiT(this.locale, "passwordHint"));
		}
		if (plan.mode === "public") {
			lines.push(uiT(this.locale, "publicHint"));
		}
		return lines.length > 0 ? `\n${lines.join("\n")}` : "";
	}

	private noteProblemsLine(count: number, plan: ModePlan): string {
		if (count === 0) {
			return "";
		}
		return `\n${uiT(this.locale, "noteProblemsSuffix", { n: count })}${plan.diagnostics ? uiT(this.locale, "seeReport") : ""}`;
	}

	private async runScopedExport(
		scope: ExportScope,
		plan: ModePlan = makeModePlan("local", null, this.settings),
		customTitle?: string,
	): Promise<void> {
		if (scope.kind === "active-note") {
			return this.runActiveNoteExport(undefined, plan);
		}
		if (scope.kind === "all-bases") {
			return this.runBaseExport(plan, customTitle);
		}
		const progress = new Notice(uiT(this.locale, "noticePreparing"), 0);
		try {
			const allBases = this.app.vault
				.getFiles()
				.filter((f) => f.extension === "base")
				.sort((a, b) => a.path.localeCompare(b.path));
			const input =
				scope.kind === "vault"
					? {
							title: customTitle ?? this.app.vault.getName(),
							baseFiles: allBases,
							extraNotes: notesUnderFolder(
								this.app,
								this.app.vault.getRoot(),
							),
							folderPaths: foldersUnder(
								this.app,
								this.app.vault.getRoot(),
							),
						}
					: scope.kind === "folder"
						? this.folderInput(scope.folder, customTitle)
						: {
								title: customTitle ?? scope.base.basename,
								baseFiles: [scope.base],
								extraNotes: [],
							};
			const r = await exportScoped(
				this.app,
				this.manifest,
				this,
				input,
				progress,
				plan,
			);
			progress.hide();
			const opened = r.openedWith
				? uiT(this.locale, "noticeOpened")
				: uiT(this.locale, "noticeOpenFailed");
			new Notice(
				`${uiT(this.locale, "doneScoped", { bases: r.pages.length, notes: r.notePageCount })}${this.noteProblemsLine(r.noteProblems.length, plan)}\n${opened}：${r.openedPath ?? ""}${this.modeNoticeLines(plan, r.exportFolder, r.zipPath)}`,
				12000,
			);
		} catch (e) {
			progress.hide();
			console.error("[VaultPack] scoped export failed", e);
			new Notice(
				`${uiT(this.locale, "exportFailed")}${e instanceof Error ? e.message : String(e)}`,
				0,
			);
		}
	}

	private async runActiveNoteExport(
		file?: TFile,
		plan: ModePlan = makeModePlan("local", null, this.settings),
	): Promise<void> {
		try {
			new Notice(uiT(this.locale, "noticeExportingNote"), 4000);
			const r = await exportActiveNote(
				this.app,
				this.manifest,
				this,
				file,
				plan,
			);
			new Notice(
				`${uiT(this.locale, "doneSingle")}\n${r.outPath}${this.noteProblemsLine(r.problems.length, plan)}${this.modeNoticeLines(plan, r.exportFolder, r.zipPath)}`,
				10000,
			);
		} catch (e) {
			console.error("[VaultPack] active note export failed", e);
			new Notice(
				`${uiT(this.locale, "exportFailed")}${e instanceof Error ? e.message : String(e)}`,
				0,
			);
		}
	}

	private async runBaseExport(
		plan: ModePlan = makeModePlan("local", null, this.settings),
		customTitle?: string,
	): Promise<void> {
		try {
			new Notice(uiT(this.locale, "noticeExportingBases"), 4000);
			const r = await exportAllBases(
				this.app,
				this.manifest,
				this,
				plan,
				customTitle,
			);
			const lines = r.pages.map(
				(p) =>
					`${p.outFile}：${p.viewCount}／${p.rowCount}${p.groupCount > 0 ? `／${p.groupCount}` : ""}${p.problems.length > 0 ? ` ⚠${p.problems.join(",")}` : ""}`,
			);
			const opened = r.openedWith
				? uiT(this.locale, "noticeOpened")
				: uiT(this.locale, "noticeOpenFailed");
			new Notice(
				`${uiT(this.locale, "doneAllBases", { bases: r.pages.length, notes: r.notePageCount })}\n${lines.join("\n")}${this.noteProblemsLine(r.noteProblems.length, plan)}\n${opened}：${r.openedPath ?? ""}${this.modeNoticeLines(plan, r.exportFolder, r.zipPath)}`,
				12000,
			);
		} catch (e) {
			console.error("[VaultPack] base export failed", e);
			new Notice(
				`${uiT(this.locale, "exportFailed")}${e instanceof Error ? e.message : String(e)}`,
				0,
			);
		}
	}

	/**
	 * Dev self-verification (acceptance loop): export books/ in every mode
	 * with one click; the checker then validates each package on disk.
	 * Test password is fixed and printed — test-vault only by design.
	 */
	private async runMatrixExport(): Promise<void> {
		const folder = this.app.vault.getFolderByPath("books");
		if (folder === null) {
			new Notice(uiT(this.locale, "matrixNoBooks"), 8000);
			return;
		}
		const modes: ExportMode[] = [
			"local",
			"public",
			"link-only",
			"password",
			"zip",
		];
		const results: string[] = [];
		const progress = new Notice(uiT(this.locale, "noticeMatrixRunning"), 0);
		try {
			const input = this.folderInput(folder);
			for (const m of modes) {
				progress.setMessage(uiT(this.locale, "matrixStep", { mode: m }));
				const plan = makeModePlan(
					m,
					m === "password" || m === "zip" ? "vaultpack-test" : null,
					this.settings,
				);
				const r = await exportScoped(
					this.app,
					this.manifest,
					this,
					input,
					null,
					plan,
				);
				results.push(
					`${m} → ${r.exportFolder}${r.zipPath !== null ? ` ＋ ${r.zipPath}` : ""}`,
				);
			}
			progress.hide();
			new Notice(
				`${uiT(this.locale, "matrixDone")}\n${results.join("\n")}\n${uiT(this.locale, "matrixTestPw")}`,
				0,
			);
		} catch (e) {
			progress.hide();
			console.error("[VaultPack] matrix export failed", e);
			new Notice(
				`${uiT(this.locale, "matrixFailed", { n: results.length })}${e instanceof Error ? e.message : String(e)}`,
				0,
			);
		}
	}

	private async runProbe(): Promise<void> {
		try {
			new Notice(uiT(this.locale, "noticeProbing"), 5000);
			const reportPath = await runBasesProbe(this.app, this);
			new Notice(`${uiT(this.locale, "probeDone")}\n${reportPath}`, 10000);
		} catch (e) {
			console.error("[VaultPack] probe failed", e);
			new Notice(
				`${uiT(this.locale, "probeFailed")}${e instanceof Error ? e.message : String(e)}`,
				0,
			);
		}
	}

	private async runExport(): Promise<void> {
		try {
			const result = await runHelloExport(this.app, this.manifest);
			const opened = result.openedWith
				? uiT(this.locale, "noticeOpened")
				: uiT(this.locale, "noticeOpenFailed");
			new Notice(`${result.indexPath}\n${opened}`, 10000);
		} catch (e) {
			console.error("[VaultPack] export failed", e);
			new Notice(
				`${uiT(this.locale, "exportFailed")}${e instanceof Error ? e.message : String(e)}`,
				0,
			);
		}
	}
}

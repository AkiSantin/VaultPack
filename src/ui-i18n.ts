import { NpLocale } from "./i18n";

/**
 * Plugin-UI strings (commands / menus / modals / notices / errors).
 * REQUIREMENTS v1.11 scope fix (user, 2026-07-04): the zh-TW/EN/JA rule
 * covers ALL user-visible text — plugin UI included, not just exported
 * pages. Same locale resolution as exported pages (resolveLocale).
 */
export type UiKey =
	// scope picker
	| "scopePickerPlaceholder"
	| "scopeAllBases"
	| "scopeVault"
	| "scopeFolder"
	| "scopeBase"
	| "scopeActiveNote"
	| "folderPickerPlaceholder"
	| "basePickerPlaceholder"
	| "vaultRootLabel"
	// mode picker + password modal
	| "modePickerPlaceholder"
	| "modeLocal"
	| "modeZip"
	| "modePublic"
	| "modeLinkOnly"
	| "modePassword"
	| "pwTitle"
	| "pwLabel"
	| "pwConfirmLabel"
	| "pwOk"
	| "pwCancel"
	| "pwTooShort"
	| "pwMismatch"
	// commands / ribbon / context menus
	| "ribbonExport"
	| "cmdPickScope"
	| "cmdAllBases"
	| "cmdTestPage"
	| "cmdActiveNote"
	| "cmdProbe"
	| "cmdMatrix"
	| "menuExportFolder"
	| "menuExportNote"
	| "menuExportBase"
	// notices / progress
	| "noticePreparing"
	| "noticeExportingNote"
	| "noticeExportingBases"
	| "noticeProbing"
	| "noticeMatrixRunning"
	| "noticeOpened"
	| "noticeOpenFailed"
	| "doneScoped"
	| "doneSingle"
	| "doneAllBases"
	| "noteProblemsSuffix"
	| "seeReport"
	| "exportFailed"
	| "probeDone"
	| "probeFailed"
	| "matrixDone"
	| "matrixFailed"
	| "matrixTestPw"
	| "matrixNoBooks"
	| "matrixStep"
	| "zipNotice"
	| "zipCompat"
	| "linkOnlyHint"
	| "passwordHint"
	| "publicHint"
	| "progressBase"
	| "progressNotes"
	| "progressPacking"
	| "progressZipping"
	// custom title prompt (user req 2026-07-04)
	| "titleTitle"
	| "titleLabel"
	| "titleOk"
	| "titleSkip"
	// loud-fail errors (user-visible via Notice)
	| "errNoActiveNote"
	| "errEmptyScope"
	| "errFolderExists"
	| "errFileExists"
	| "errZipExists"
	| "errNameCollision"
	| "errZipEmpty"
	| "errPasswordMissing";

const STRINGS: Record<NpLocale, Record<UiKey, string>> = {
	en: {
		scopePickerPlaceholder: "Choose what to export…",
		scopeAllBases: "All Bases + related notes",
		scopeVault: "Entire vault (all notes + all Bases)",
		scopeFolder: "Pick a folder…",
		scopeBase: "Pick a Base…",
		scopeActiveNote: "Currently open note (single)",
		folderPickerPlaceholder: "Choose a folder…",
		basePickerPlaceholder: "Choose a Base…",
		vaultRootLabel: "/ (vault root)",
		modePickerPlaceholder: "Choose the output mode…",
		modeLocal: "Local folder — a normal offline folder you can open locally",
		modeZip: "Encrypted ZIP — needs a password before extraction; extracted files are normal files",
		modePublic: "Web: Public — anyone can view and search engines may index it",
		modeLinkOnly: "Web: Link-only — anyone with the link can view; hidden from search engines and listings",
		modePassword: "Web: Password-protected — link + password required; needs Apache/PHP hosting",
		pwTitle: "Set a password",
		pwLabel: "Password (4+ characters)",
		pwConfirmLabel: "Type it again to confirm",
		pwOk: "OK",
		pwCancel: "Cancel",
		pwTooShort: "Password too short (4+ characters)",
		pwMismatch: "The two entries do not match",
		ribbonExport: "VaultPack: Export (choose scope)",
		cmdPickScope: "Export (choose scope)…",
		cmdAllBases: "Export all Bases + related notes",
		cmdTestPage: "Export test page (phase 0)",
		cmdActiveNote: "Export the open note (single; good for big vaults)",
		cmdProbe: "Phase-1 probe (Bases environment)",
		cmdMatrix: "Five-mode test export (books folder, dev self-check)",
		menuExportFolder: "VaultPack: Export this folder",
		menuExportNote: "VaultPack: Export this note",
		menuExportBase: "VaultPack: Export this Base",
		noticePreparing: "VaultPack: preparing export…",
		noticeExportingNote: "VaultPack: exporting note…",
		noticeExportingBases: "VaultPack: exporting Bases (tabs may briefly open/close)…",
		noticeProbing: "VaultPack: probing (2–8 s; a tab may briefly open/close)…",
		noticeMatrixRunning: "VaultPack: five-mode test export…",
		noticeOpened: "Opened in your browser",
		noticeOpenFailed: "Could not auto-open — please open it manually",
		doneScoped: "VaultPack export done ({bases} Bases + {notes} notes)",
		doneSingle: "VaultPack single-note export done:",
		doneAllBases: "VaultPack export done ({bases} Bases + {notes} note pages)",
		noteProblemsSuffix: "⚠ {n} note problem(s)",
		seeReport: " (see export-report.json)",
		exportFailed: "VaultPack export failed: ",
		probeDone: "VaultPack probe done:",
		probeFailed: "VaultPack probe failed: ",
		matrixDone: "VaultPack matrix done:",
		matrixFailed: "VaultPack matrix failed (completed: {n}): ",
		matrixTestPw: "(password/zip test password: vaultpack-test)",
		matrixNoBooks: "books folder not found (this command is for test-vault self-checks)",
		matrixStep: "VaultPack matrix: {mode}…",
		zipNotice: "Encrypted ZIP: {path}",
		zipCompat: "(macOS's built-in extractor cannot open AES ZIPs — use The Unarchiver / Keka / 7-Zip; extracted files are normal files)",
		linkOnlyHint: "After uploading the whole folder, the full entry URL is …/{folder}/START_HERE.html (the random folder name IS the link — do not rename it)",
		passwordHint: "After uploading the whole folder, opening the folder URL shows the login page; run the self-check link at the bottom of the login page first to verify the host blocks the private folder",
		publicHint: "Public mode: search engines may index this package",
		progressBase: "VaultPack: Base {i}/{n} — {name}",
		progressNotes: "VaultPack: notes {done}/{total}",
		progressPacking: "VaultPack: finishing package…",
		progressZipping: "VaultPack: encrypting {done}/{total}",
		titleTitle: "Package title",
		titleLabel: "Custom title (leave empty for the default)",
		titleOk: "Export",
		titleSkip: "Use default",
		errNoActiveNote: "Open a note in Obsidian first",
		errEmptyScope: "Nothing to export in this scope (no Base or note)",
		errFolderExists: "Export folder already exists; refusing to overwrite: {path}",
		errFileExists: "File already exists; refusing to overwrite: {path}",
		errZipExists: "ZIP already exists; refusing to overwrite: {path}",
		errNameCollision: "Filename collision (loud fail): {file} ← {a} vs {b}",
		errZipEmpty: "Encrypted ZIP: folder has no files ({path})",
		errPasswordMissing: "Password mode is missing its password or private folder (loud fail)",
	},
	"zh-TW": {
		scopePickerPlaceholder: "選擇匯出範圍…",
		scopeAllBases: "全部 Bases＋相關筆記",
		scopeVault: "整個 vault（全部筆記＋全部 Bases）",
		scopeFolder: "選一個資料夾…",
		scopeBase: "選一個 Base…",
		scopeActiveNote: "目前開啟的筆記（單篇）",
		folderPickerPlaceholder: "選擇資料夾…",
		basePickerPlaceholder: "選擇 Base…",
		vaultRootLabel: "/（vault 根目錄）",
		modePickerPlaceholder: "選擇輸出方式…",
		modeLocal: "本機資料夾 — 普通離線資料夾，本機直接打開",
		modeZip: "加密 ZIP — 解壓前需要密碼；解壓後為一般檔案",
		modePublic: "Web：公開 — 任何人可看，搜尋引擎可能收錄",
		modeLinkOnly: "Web：僅限連結 — 知道連結的人可看；不進搜尋引擎與目錄列表",
		modePassword: "Web：密碼保護 — 需要連結＋密碼；需 Apache/PHP 主機",
		pwTitle: "設定密碼",
		pwLabel: "密碼（至少 4 字元）",
		pwConfirmLabel: "再輸入一次確認",
		pwOk: "確定",
		pwCancel: "取消",
		pwTooShort: "密碼太短（至少 4 字元）",
		pwMismatch: "兩次輸入不一致",
		ribbonExport: "VaultPack：匯出（選擇範圍）",
		cmdPickScope: "匯出（選擇範圍）…",
		cmdAllBases: "匯出全部 Bases＋相關筆記",
		cmdTestPage: "匯出測試頁（階段 0）",
		cmdActiveNote: "匯出目前開啟的筆記（單篇，適合大 vault 測試）",
		cmdProbe: "階段 1 探測（Bases 環境）",
		cmdMatrix: "五模式測試匯出（books 資料夾，開發自驗用）",
		menuExportFolder: "VaultPack：匯出此資料夾",
		menuExportNote: "VaultPack：匯出此筆記",
		menuExportBase: "VaultPack：匯出此 Base",
		noticePreparing: "VaultPack：準備匯出…",
		noticeExportingNote: "VaultPack：匯出筆記中…",
		noticeExportingBases: "VaultPack：匯出 Bases 中（會短暫開關分頁）…",
		noticeProbing: "VaultPack：探測中（約 2–8 秒，會短暫開關一個分頁）…",
		noticeMatrixRunning: "VaultPack：五模式測試匯出…",
		noticeOpened: "已自動用瀏覽器開啟",
		noticeOpenFailed: "未能自動開啟，請手動打開",
		doneScoped: "VaultPack 匯出完成（{bases} 個 Base＋{notes} 篇筆記）",
		doneSingle: "VaultPack 單篇匯出完成：",
		doneAllBases: "VaultPack 匯出完成（{bases} 個 Base＋{notes} 篇筆記頁）",
		noteProblemsSuffix: "⚠ 筆記問題 {n} 件",
		seeReport: "（詳見 export-report.json）",
		exportFailed: "VaultPack 匯出失敗：",
		probeDone: "VaultPack 探測完成：",
		probeFailed: "VaultPack 探測失敗：",
		matrixDone: "VaultPack matrix 完成：",
		matrixFailed: "VaultPack matrix 失敗（已完成：{n}）：",
		matrixTestPw: "（password／zip 測試密碼：vaultpack-test）",
		matrixNoBooks: "找不到 books 資料夾（此指令供 test-vault 開發自驗用）",
		matrixStep: "VaultPack matrix：{mode}…",
		zipNotice: "加密 ZIP：{path}",
		zipCompat: "（macOS 內建解壓不支援 AES，請用 The Unarchiver / Keka / 7-Zip；解壓後為一般檔案）",
		linkOnlyHint: "上傳整個資料夾後，完整入口網址＝…/{folder}/START_HERE.html（高亂度資料夾名＝連結本身，別改名）",
		passwordHint: "上傳整個資料夾後，開資料夾網址即出現登入頁；先用登入頁下方 self-check 驗證主機有擋住私有資料夾",
		publicHint: "公開模式：搜尋引擎可收錄此包",
		progressBase: "VaultPack：Base {i}/{n} — {name}",
		progressNotes: "VaultPack：筆記 {done}/{total}",
		progressPacking: "VaultPack：打包收尾…",
		progressZipping: "VaultPack：壓縮加密中 {done}/{total}",
		titleTitle: "成品標題",
		titleLabel: "自訂標題（留空用預設）",
		titleOk: "匯出",
		titleSkip: "用預設",
		errNoActiveNote: "請先在 Obsidian 開啟一篇筆記再執行",
		errEmptyScope: "此範圍內沒有任何 Base 或筆記可匯出",
		errFolderExists: "輸出資料夾已存在，拒絕覆寫：{path}",
		errFileExists: "檔案已存在，拒絕覆寫：{path}",
		errZipExists: "ZIP 已存在，拒絕覆寫：{path}",
		errNameCollision: "檔名碰撞（loud fail）：{file} ← {a} 與 {b}",
		errZipEmpty: "加密 ZIP：資料夾內沒有檔案（{path}）",
		errPasswordMissing: "password 模式缺少密碼或私有資料夾（loud fail）",
	},
	ja: {
		scopePickerPlaceholder: "エクスポート範囲を選択…",
		scopeAllBases: "すべての Bases＋関連ノート",
		scopeVault: "vault 全体（全ノート＋全 Bases）",
		scopeFolder: "フォルダを選ぶ…",
		scopeBase: "Base を選ぶ…",
		scopeActiveNote: "現在開いているノート（単体）",
		folderPickerPlaceholder: "フォルダを選択…",
		basePickerPlaceholder: "Base を選択…",
		vaultRootLabel: "/（vault ルート）",
		modePickerPlaceholder: "出力方式を選択…",
		modeLocal: "ローカルフォルダ — 普通のオフラインフォルダ。ローカルでそのまま開けます",
		modeZip: "暗号化 ZIP — 解凍前にパスワードが必要。解凍後は通常のファイルです",
		modePublic: "Web：公開 — 誰でも閲覧でき、検索エンジンに載る可能性があります",
		modeLinkOnly: "Web：リンク限定 — リンクを知っている人だけ閲覧可。検索エンジンと一覧には出しません",
		modePassword: "Web：パスワード保護 — リンク＋パスワードが必要。Apache/PHP ホスティングが必要です",
		pwTitle: "パスワードを設定",
		pwLabel: "パスワード（4 文字以上）",
		pwConfirmLabel: "確認のためもう一度入力",
		pwOk: "OK",
		pwCancel: "キャンセル",
		pwTooShort: "パスワードが短すぎます（4 文字以上）",
		pwMismatch: "2 回の入力が一致しません",
		ribbonExport: "VaultPack：エクスポート（範囲を選択）",
		cmdPickScope: "エクスポート（範囲を選択）…",
		cmdAllBases: "すべての Bases＋関連ノートをエクスポート",
		cmdTestPage: "テストページをエクスポート（フェーズ 0）",
		cmdActiveNote: "開いているノートをエクスポート（単体、大きな vault 向け）",
		cmdProbe: "フェーズ 1 プローブ（Bases 環境）",
		cmdMatrix: "5 モードテストエクスポート（books フォルダ、開発セルフチェック用）",
		menuExportFolder: "VaultPack：このフォルダをエクスポート",
		menuExportNote: "VaultPack：このノートをエクスポート",
		menuExportBase: "VaultPack：この Base をエクスポート",
		noticePreparing: "VaultPack：エクスポート準備中…",
		noticeExportingNote: "VaultPack：ノートをエクスポート中…",
		noticeExportingBases: "VaultPack：Bases をエクスポート中（タブが一時的に開閉します）…",
		noticeProbing: "VaultPack：プローブ中（約 2–8 秒、タブが一時的に開閉します）…",
		noticeMatrixRunning: "VaultPack：5 モードテストエクスポート…",
		noticeOpened: "ブラウザで自動的に開きました",
		noticeOpenFailed: "自動で開けませんでした。手動で開いてください",
		doneScoped: "VaultPack エクスポート完了（Base {bases} 件＋ノート {notes} 件）",
		doneSingle: "VaultPack 単体エクスポート完了：",
		doneAllBases: "VaultPack エクスポート完了（Base {bases} 件＋ノートページ {notes} 件）",
		noteProblemsSuffix: "⚠ ノートの問題 {n} 件",
		seeReport: "（詳細は export-report.json）",
		exportFailed: "VaultPack エクスポート失敗：",
		probeDone: "VaultPack プローブ完了：",
		probeFailed: "VaultPack プローブ失敗：",
		matrixDone: "VaultPack matrix 完了：",
		matrixFailed: "VaultPack matrix 失敗（完了：{n}）：",
		matrixTestPw: "（password／zip テストパスワード：vaultpack-test）",
		matrixNoBooks: "books フォルダが見つかりません(このコマンドは test-vault のセルフチェック用です)",
		matrixStep: "VaultPack matrix：{mode}…",
		zipNotice: "暗号化 ZIP：{path}",
		zipCompat: "（macOS 標準の解凍機能は AES ZIP に非対応です。The Unarchiver / Keka / 7-Zip をご利用ください。解凍後は通常のファイルです）",
		linkOnlyHint: "フォルダごとアップロード後、入口 URL は …/{folder}/START_HERE.html（ランダムなフォルダ名がリンクそのものです。名前を変えないでください）",
		passwordHint: "フォルダごとアップロード後、フォルダの URL を開くとログインページが表示されます。まずログインページ下部の self-check でプライベートフォルダが遮断されているか確認してください",
		publicHint: "公開モード：このパッケージは検索エンジンに載る可能性があります",
		progressBase: "VaultPack：Base {i}/{n} — {name}",
		progressNotes: "VaultPack：ノート {done}/{total}",
		progressPacking: "VaultPack：パッケージ仕上げ中…",
		progressZipping: "VaultPack：暗号化中 {done}/{total}",
		titleTitle: "パッケージのタイトル",
		titleLabel: "カスタムタイトル（空欄なら既定値）",
		titleOk: "エクスポート",
		titleSkip: "既定値を使う",
		errNoActiveNote: "先に Obsidian でノートを開いてください",
		errEmptyScope: "この範囲にはエクスポートできる Base やノートがありません",
		errFolderExists: "出力フォルダが既に存在するため上書きを拒否：{path}",
		errFileExists: "ファイルが既に存在するため上書きを拒否：{path}",
		errZipExists: "ZIP が既に存在するため上書きを拒否：{path}",
		errNameCollision: "ファイル名の衝突（loud fail）：{file} ← {a} と {b}",
		errZipEmpty: "暗号化 ZIP：フォルダにファイルがありません（{path}）",
		errPasswordMissing: "パスワードモードにパスワードまたはプライベートフォルダがありません（loud fail）",
	},
};

export function uiT(
	locale: NpLocale,
	key: UiKey,
	vars?: Record<string, string | number>,
): string {
	let s = STRINGS[locale][key];
	if (vars) {
		for (const [k, v] of Object.entries(vars)) {
			s = s.replace(`{${k}}`, String(v));
		}
	}
	return s;
}

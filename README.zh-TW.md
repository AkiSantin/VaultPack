# VaultPack for Obsidian

[English](README.md) | [日本語](README.ja.md)

把你在 Obsidian 中選取的內容——**包含 Bases views**——匯出成自成一體、可離線閱讀的靜態網站。你可以把它當作一般資料夾分享、輸出為 AES 加密 ZIP，或上傳到一般 web 主機，必要時加上密碼保護。

![VaultPack 匯出頁預覽](_files/VaultPack_01.png)

## 功能

- **真正匯出 Bases** — 支援根層 `.base` 頁面與 `![[File.base#View]]`
  嵌入（含 `this` 語境運算）、具名 views、分組、formula 欄位、
  `displayName` 欄名、summaries（總計與各分組小計），以及 table /
  list / cards views（含封面圖）。
- **五種輸出模式**

| 模式 | 會得到什麼 |
|---|---|
| 本機資料夾 | 一般離線資料夾，打開 `START_HERE.html` 即可閱讀 |
| 加密 ZIP | AES-256 壓縮檔，解壓縮前需要密碼 |
| Web：公開 | 可上傳資料夾，可被搜尋引擎索引 |
| Web：僅限連結 | 高亂度資料夾名、全站 `noindex`、無 referrer 洩漏，適合「知道連結的人可看」分享 |
| Web：密碼 | 產生 PHP 登入 gate（bcrypt、session、防路徑穿越），可用於一般 Apache/PHP 共享主機，並附主機 self-check 頁 |

- **Publish 風格側欄** — 套件標題、離線全文搜尋、可收合的資料夾/檔案樹（真實資料夾結構、`BASE` 標籤、目前頁面高亮）；手機上收合為選單按鈕。
- **忠實的筆記頁面** — properties 區塊、callouts、註腳、Mermaid、MathJax（轉成自成一體的 SVG）、22 種 task list 狀態（以 Font Awesome 圖示呈現）、含離線 copy 按鈕的 code blocks。
- **零依賴輸出** — 每一頁都可從 `file://` 開啟；不需 CDN、不抓字型、不含 framework。Design tokens（CSS custom properties）讓重新套色只需改單一檔案。
- **多語言** — 外掛 UI 與匯出頁跟隨 Obsidian 介面語言：繁體中文（zh-TW）、英文、日文；其他語言 fallback 英文。
- **預設安全** — 永不修改你的筆記；每次匯出都是全新的 timestamped folder；檔名使用不透明 ASCII hash（筆記標題不會洩漏到 URL）；共享輸出會移除 `obsidian://` deep links。

![VaultPack 功能預覽](_files/VaultPack_02.png)

## 使用方式

- 點 ribbon 的 **package** 圖示，或從 command palette 執行 `Export (choose scope)...` -> 選範圍（所有 Bases / 整個 vault / 資料夾 / 單一 Base / 目前筆記）-> 選輸出模式 -> 可選擇自訂標題。
- 在資料夾上按右鍵，或使用筆記 / Base 的 `...` 選單，可以只匯出該項目。
- 資料夾匯出會自動包含所選筆記內嵌引用的 Bases，不論那些 `.base` 檔案放在哪裡。

![VaultPack 匯出流程](_files/VaultPack_03.png)

### 30 秒理解密碼模式

把整個匯出資料夾上傳到主機。打開資料夾 URL 後會看到登入頁；分享連結前，先點底部的 **self-check**，確認主機真的會阻擋直接讀取 private folder。需要 Apache `.htaccess` + `mod_rewrite` 與 PHP sessions（常見 WordPress 等級共享主機通常具備）。

> **誠實的安全模型：** Link-only 模式降低被發現機率，但不是 access control。Password 模式保護 web 存取入口，但不會加密主機上的檔案，也不能防主機商讀取內容。加密 ZIP 保護的是壓縮檔；解壓縮後仍是一般檔案。

## 設定

- Web packages 是否包含 diagnostics files（預設關）
- Link-only/password exports 是否使用高亂度資料夾名（預設開）
- Developer mode — 額外 self-test 指令（預設關）
- Password mode 的 "Remember me" session 保存天數（預設 30 天）

匯出頁的連結與 task 圖示會跟隨你的 Obsidian **accent color**（匯出當下捕捉）。

## Network use（揭露）

VaultPack 只會在**匯出期間**發出網路請求，而且只用來替筆記中的外部內容建立離線 embed cards：

- `youtube.com/oembed` + 影片縮圖（會打包進輸出）
- `publish.twitter.com/oembed` for tweets

沒有 telemetry，沒有 analytics；你的 vault 內容不會被傳到任何地方。離線也能匯出，外部 embeds 會降級成一般 link cards。

## 需求

- Obsidian **1.12.7+**（Bases），僅桌面版（使用 desktop rendering pipeline 與 file-system adapter）。

## Development

```bash
npm install
npm run build   # type-check + bundle main.js
```

Repository 內含 checker（父專案的 `scripts/check-export.mjs`）與 `test-harness/` 底下的 headless test harnesses。

## Credits & license

- 外掛程式碼：MIT（見 `LICENSE`）。
- Checkbox icons：[Font Awesome Free](https://fontawesome.com) by
  @fontawesome，icons 採
  [CC BY 4.0](https://fontawesome.com/license/free) 授權，並以 static SVG
  path data 形式打包於 `src/checkbox-icons.ts`。

# VaultPack

[English](README.md) | [繁體中文](README.zh-TW.md)

Obsidian で選択したコンテンツ——**Bases views を含む**——を、自己完結型でオフライン閲覧できる静的サイトとして書き出します。通常のフォルダ、AES 暗号化 ZIP、または任意の Web ホストへアップロードできるフォルダとして共有でき、必要に応じてパスワード保護も付けられます。

![VaultPack の書き出しプレビュー](_files/VaultPack_01.png)

## 機能

- **Bases を実用的に書き出し** — ルートの `.base` ページと
  `![[File.base#View]]` 埋め込み（`this` コンテキスト評価を含む）、
  名前付き views、グループ、formula 列、`displayName` ヘッダー、
  summaries（全体 + グループごと）、table / list / cards views（カバー画像付き）に対応。
- **5 つの出力モード**

| モード | 出力内容 |
|---|---|
| ローカルフォルダ | 通常のオフラインフォルダ。`START_HERE.html` を開くだけで閲覧できます |
| 暗号化 ZIP | AES-256 アーカイブ（展開前にパスワードが必要） |
| Web：公開 | Web ホストへアップロードでき、検索エンジンに index されるフォルダ |
| Web：リンク限定 | 推測困難なフォルダ名、全体 `noindex`、referrer 漏えいなし。「リンクを知っている人だけ」向け |
| Web：パスワード | 一般的な Apache/PHP 共有ホスティング向けの PHP ログイン gate（bcrypt、sessions、path traversal 対策）とホスト self-check ページ |

- **Publish 風サイドバー** — パッケージタイトル、オフライン全文検索、折りたたみ可能なフォルダ/ファイルツリー（実フォルダ構造、`BASE` バッジ、現在ページのハイライト）。モバイルではメニューボタンに折りたたまれます。
- **忠実なノートページ** — properties ブロック、callouts、脚注、Mermaid、MathJax（自己完結 SVG に変換）、22 種類の task list 状態（Font Awesome アイコン表示）、オフライン copy ボタン付き code blocks。
- **依存関係ゼロの出力** — すべてのページが `file://` から動作します。CDN、外部フォント、framework は不要。Design tokens（CSS custom properties）により、見た目の再調整は単一ファイルで行えます。
- **多言語対応** — UI と書き出しページは Obsidian の言語設定に追従します：繁體中文（zh-TW）、English、日本語。その他の言語は English に fallback します。
- **安全を前提に設計** — 元のノートは一切変更しません。各 export は新しい timestamped folder として作成されます。ファイル名は不透明な ASCII hash（ノートタイトルが URL に漏れません）。共有出力では `obsidian://` deep links を取り除きます。

![VaultPack の機能プレビュー](_files/VaultPack_02.png)

## 使い方

- Ribbon の **package** アイコン、または command palette の `Export (choose scope)...` を実行 -> 範囲（すべての Bases / vault 全体 / フォルダ / 1 つの Base / 開いているノート）を選択 -> 出力モードを選択 -> 必要に応じてタイトルを指定。
- フォルダを右クリック、またはノート / Base の `...` メニューから、その項目だけを書き出せます。
- フォルダ export では、選択したノートが埋め込んでいる Bases も自動的に含めます。`.base` ファイルがどこにあっても対象です。

![VaultPack の書き出し手順](_files/VaultPack_03.png)

### パスワードモードを 30 秒で

書き出されたフォルダ全体をホストへアップロードします。フォルダ URL を開くとログインページが表示されます。共有前に、ページ下部の **self-check** を実行してください。ホストが private folder への直接アクセスを本当に遮断しているか確認できます。Apache の `.htaccess` + `mod_rewrite` と PHP sessions が必要です（一般的な WordPress 向け共有ホスティングなら多くの場合対応しています）。

> **正直なセキュリティモデル：** Link-only mode は見つかりにくくするためのもので、access control ではありません。Password mode は Web アクセスを gate しますが、ホスト上のファイルを暗号化せず、ホスティング事業者から内容を保護するものでもありません。Encrypted ZIP が保護するのはアーカイブであり、展開後のファイルは通常のファイルです。

## 設定

- Web packages に diagnostics files を含める（既定オフ）
- Link-only/password exports で高エントロピーのフォルダ名を使う（既定オン）
- Developer mode — 追加 self-test commands（既定オフ）
- Password mode の "Remember me" session lifetime（既定 30 日）

書き出されたリンクと task アイコンは、Obsidian の **accent color** に追従します（export 時に取得）。

## Network use（開示）

VaultPack がネットワークリクエストを行うのは**export 中のみ**です。用途は、ノート内の外部コンテンツからオフライン embed cards を作成することだけです：

- `youtube.com/oembed` + video thumbnail（パッケージに同梱）
- `publish.twitter.com/oembed` for tweets

Telemetry や analytics はありません。vault の内容が外部へ送信されることもありません。オフラインでも export は可能で、その場合 external embeds は通常の link cards に fallback します。

## 必要環境

- Obsidian **1.12.7+**（Bases）、desktop only（desktop rendering pipeline と file-system adapter を使用）。

## Development

```bash
npm install
npm run build   # type-check + bundle main.js
```

Repository には checker（親プロジェクトの `scripts/check-export.mjs`）と、`test-harness/` 以下の headless test harnesses が含まれています。

## Credits & license

- Plugin code：MIT（`LICENSE` を参照）。
- Checkbox icons：[Font Awesome Free](https://fontawesome.com) by
  @fontawesome。Icons は
  [CC BY 4.0](https://fontawesome.com/license/free) でライセンスされ、
  `src/checkbox-icons.ts` に static SVG path data として同梱されています。

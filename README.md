# ハミングコード MVP v0.11 Vite版

v0.10.2の静的HTML/CSS/JS版を、Vite構成へ移行した版です。

## v0.11で変更したこと

- Vite構成へ移行
- `src/main.js` / `src/styles.css` に分離
- `package.json` を追加
- `npm run dev` / `npm run build` / `npm run preview` に対応
- Vercel向けに `vercel.json` を追加
- Basic Pitch連携準備枠を `src/main.js` に追加
- 既存の簡易解析・コード進行編集・MIDI出力・スマホUIは維持

## ファイル構成

```text
package.json
vercel.json
index.html
src/
  main.js
  styles.css
README.md
```

## ローカル確認

```bash
npm install
npm run dev
```

表示されたローカルURLを開いて確認してください。

## ビルド確認

```bash
npm run build
npm run preview
```

## Vercel設定

Vercelでは基本的に自動判定でOKですが、必要なら以下にしてください。

```text
Framework Preset: Vite
Build Command: npm run build
Output Directory: dist
Install Command: npm install
```

## Basic Pitch連携の次ステップ

v0.12以降で以下を進めます。

```text
1. Basic Pitch関連パッケージの導入
2. 音声ファイルからメロディMIDI / notes を取得
3. 現在の簡易ピッチ検出結果と差し替え
4. 参考コード生成へ接続
5. スマホでの処理負荷を確認
```

## 注意

v0.11では、まだBasic Pitch本体は動いていません。
今まで通りブラウザ内の簡易ピッチ検出を使っています。

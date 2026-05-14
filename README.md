# ハミングコード MVP v0.12.1 Basic Pitchリサンプリング対応版

v0.11 Vite版をベースに、Basic Pitchの読み込みテスト欄を追加した版です。

## v0.12.1で修正したこと

- Basic Pitch実行時に `Input audio buffer is not at correct sample rate! Is 48000. Should be 22050` が出る問題を修正
- Basic Pitchに渡す前に音声を自動で22050Hzへリサンプリング
- 複数チャンネル音声をモノラル化してからBasic Pitchへ渡す処理を追加
- 既存の簡易解析・UI・Vercel構成は維持

## v0.12で変更したこと

- `@spotify/basic-pitch` を依存パッケージに追加
- Basic Pitchモデルファイルを `public/basic-pitch-model/` にコピーするスクリプトを追加
- `Basic Pitch連携テスト` ブロックを追加
- 既存の簡易解析にはまだ反映せず、Basic Pitchで音符候補が取れるかだけ確認
- Basic Pitchの進捗バー・検出音数・検出メモ表示を追加
- Vercelビルド時にモデルコピー → Viteビルドの順で動くように調整

## ファイル構成

```text
package.json
vercel.json
index.html
scripts/
  copy-basic-pitch-model.mjs
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

`npm install` 後に、以下が自動生成されます。

```text
public/basic-pitch-model/model.json
public/basic-pitch-model/group1-shard1of1.bin
```

もし生成されない場合は、手動で以下を実行してください。

```bash
npm run copy-basic-pitch-model
```

## Vercel設定

基本は自動判定でOKです。

```text
Framework Preset: Vite
Build Command: npm run build
Output Directory: dist
Install Command: npm install
```

## v0.12での確認手順

```text
1. 音声ファイルを選択、または録音
2. 既存の簡易解析が完了する
3. Basic Pitch連携テスト欄へ移動
4. 「Basic Pitchで解析テスト」を押す
5. 進捗バーが進むか確認
6. Basic Pitch検出音数が出るか確認
7. 検出メモに start / dur / conf が出るか確認
```

## 注意

v0.12.1では、Basic Pitchの検出結果はまだコード生成へ反映していません。

次のv0.13で、

```text
Basic Pitch検出音
↓
既存の detectedNotes 形式へ変換
↓
推定キー・参考コード生成へ接続
```

の流れに進みます。

# ハミングコード MVP v0.13 Basic Pitch反映版

v0.11 Vite版をベースに、Basic Pitchの読み込みテスト欄を追加した版です。

## v0.13で変更したこと

- Basic Pitch検出音を既存のキー推定・参考コード生成へ反映可能に変更
- `Basic Pitch結果をコード生成に反映` ボタンを追加
- `簡易解析に戻す` ボタンを追加
- Basic Pitch結果を使った場合、確認・出力に `Analysis Source: basic-pitch` を表示
- JSON出力に `analysisSource` と `basicPitchNotes` を追加
- Basic Pitch検出音から再生BPM・キー・参考コード・4拍マスを再生成

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

v0.13では、Basic Pitchの検出結果をコード生成へ反映できます。

次のv0.13で、

```text
Basic Pitch検出音
↓
既存の detectedNotes 形式へ変換
↓
推定キー・参考コード生成へ接続
```

の流れに進みます。


## v0.13での確認手順

```text
1. 音声ファイルを選択、または録音
2. まず通常の簡易解析が完了する
3. Basic Pitch連携テスト欄へ移動
4. 「Basic Pitchで解析テスト」を押す
5. 検出音数が出る
6. 「Basic Pitch結果をコード生成に反映」を押す
7. 解析結果・参考コード・4拍マスがBasic Pitch結果ベースに更新される
8. 必要なら「簡易解析に戻す」で元の簡易解析ベースへ戻す
```

## 次の改善候補

v0.14では、Basic Pitch検出音をそのまま使うだけでなく、以下を調整できます。

```text
・信頼度しきい値の手動調整
・短すぎる音の除外
・近い音の結合
・Basic Pitch結果と簡易解析結果の比較表示
・Basic Pitch結果を初期解析として自動採用する設定
```

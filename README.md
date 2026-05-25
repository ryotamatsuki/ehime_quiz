# 愛媛県クイズ100

愛媛県の新規採用職員向けに、県土・人口・産業・農林水産・観光文化・防災環境・県政運営・生活基盤を学ぶブラウザ型クイズ教材です。

要件定義書 `愛媛県クイズ_100_要件定義書.md` に基づき、静的HTML/CSS/JavaScriptとJSONデータで動作する構成にしています。個人情報の入力やサーバー保存は行いません。

## 主な機能

- 100問の4択クイズをJSONから読み込み
- はじめてモード、研修モード、ランダム10問、カテゴリ別、100問チャレンジ、県職員力診断
- 回答後の正誤判定、解説、出典リンク表示
- 最終結果、正答率、称号、カテゴリ別正答率
- 間違えた問題の復習
- 出典一覧、教材概要画面
- キーボード操作対応
- スマートフォン、タブレット、PC向けレスポンシブ表示
- LocalStorageによる途中再開

## ファイル構成

```text
.
├── index.html
├── style.css
├── game.js
├── dev-server.js
├── start-quiz.bat
├── assets/
│   └── ehime_quiz_promotional_collage_poster.png
├── data/
│   ├── config.json
│   ├── ehime_new_staff_quiz_100.json
│   └── ehime_new_staff_quiz_100.csv
└── 愛媛県クイズ_100_要件定義書.md
```

## 起動方法

JSONを `fetch` で読み込むため、HTMLファイルを直接開くのではなく、ローカルHTTPサーバーで配信してください。

Windowsでは、`start-quiz.bat` をダブルクリックするとローカルHTTPサーバーを起動し、ブラウザでクイズを開きます。終了するときは、起動時に開いたサーバー用のコマンドプロンプトを閉じてください。

手動で起動する場合は、次のコマンドを使います。

```powershell
node dev-server.js 8000
```

起動後、ブラウザで次を開きます。

```text
http://127.0.0.1:8000/
```

別のポートを使う場合は、引数を変更します。

```powershell
node dev-server.js 8080
```

## 問題データ

クイズ本体は次のJSONを読み込みます。

```text
data/ehime_new_staff_quiz_100.json
```

各問題は次の情報を持ちます。

- `id`
- `category`
- `type`
- `difficulty`
- `update_required`
- `question`
- `choices`
- `answer_index`
- `answer`
- `explanation`
- `source_ids`
- `sources`

`answer_index` は0始まりです。たとえば1つ目の選択肢が正解なら `0`、4つ目なら `3` を指定します。

## 設定ファイル

称号、カテゴリ説明、モード表示名などは次で管理します。

```text
data/config.json
```

称号の判定基準を変える場合は、`titles` の `min`、`name`、`description` を編集してください。

## データ更新時の確認

問題データを更新したら、最低限次を確認してください。

- 全問題に4つの選択肢がある
- `answer_index` と `answer` が一致している
- 解説が入っている
- 出典が入っている
- 統計値や予算額など年度更新が必要な問題は `update_required: true` になっている

PowerShellで簡易チェックできます。

```powershell
$d = Get-Content -Raw -Encoding UTF8 data\ehime_new_staff_quiz_100.json | ConvertFrom-Json
$bad = $d.questions | Where-Object { $_.choices.Count -ne 4 -or $_.choices[$_.answer_index] -ne $_.answer -or -not $_.sources }
if ($bad) { $bad | Select-Object id,question } else { "questions_ok=$($d.questions.Count)" }
```

## 開発時の検証

JavaScriptの構文チェック:

```powershell
node --check game.js
node --check dev-server.js
```

ローカル配信確認:

```powershell
(Invoke-WebRequest -UseBasicParsing -Uri http://127.0.0.1:8000/).StatusCode
```

`200` が返れば配信できています。

## 運用メモ

- 庁内研修で投影する場合は、研修モードがおすすめです。
- 研修モードでは「各問後に解説を表示」と「20分タイマー」を画面上で切り替えられます。
- 100問チャレンジなど長いモードでは、進捗がブラウザのLocalStorageに一時保存されます。
- 個人別成績のサーバー保存、認証、ランキング機能は初期実装の対象外です。

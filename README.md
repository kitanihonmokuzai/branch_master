# 銘木市 枝番号別集計（Webアプリ版）

もとの Excel(xlsm) を Web アプリ化したものです。
- 市場の「回」（開催日）ごとにデータを分けて記録
- 枝番号・材積の両方が揃わないと登録できない（片方入力漏れを構造的に防止）
- 回ごとの枝番別集計・棒グラフ
- 複数回をまたいだ枝番別材積の推移比較（折れ線グラフ）

## 技術構成
- Next.js 14 (App Router)
- Supabase（Postgres + 匿名アクセスのREST API）
- recharts（グラフ）

## セットアップ手順

### 1. Supabaseプロジェクトの準備
1. Supabase のプロジェクトを作成（既存プロジェクトの流用も可）
2. SQL Editor を開き、`supabase/schema.sql` の内容をそのまま実行
   - `branch_master`（枝番マスタ、初期データ50件入り）
   - `markets`（回）
   - `entries`（入力明細）
   のテーブルが作成されます
3. Project Settings → API から `Project URL` と `anon public key` を控える

### 2. GitHubへのプッシュ
```powershell
cd meiboku-app
git init
git add .
git commit -m "銘木市集計アプリ 初回コミット"
git branch -M main
git remote add origin https://github.com/kitanihonmokuzai/<リポジトリ名>.git
git push -u origin main
```

### 3. Vercelでのデプロイ
1. Vercel で新規プロジェクトとしてこのリポジトリをインポート
2. Environment Variables に以下を設定（`.env.local.example` 参照）
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Deploy

これで発行されたURLに、どのパソコンからでもアクセス・入力できるようになります（アクセス制限なし＝URLを知っていれば誰でも入力可）。

### ローカルで動作確認する場合
```bash
npm install
cp .env.local.example .env.local   # 値をSupabaseの実際の値に書き換える
npm run dev
```

## 使い方
1. トップページで「新しい回を作成」（開催日を入力）
2. 回を開き、枝番号・材積を入力して「追加」
   - 登録すると枝番号は保持されたまま材積欄だけクリアされるので、同じ枝番が続く場合はそのまま連続入力できます
3. 同じページ内で、その回の枝番別集計・棒グラフを確認できます
4. 「推移グラフ」ページで、比較したい枝番号にチェックを入れると、回をまたいだ材積の推移を折れ線グラフで確認できます

## 元のExcelとの対応
| 元のExcel | Webアプリ |
|---|---|
| 入力シート | 各回の詳細ページの「物件入力」フォーム |
| 集計シート | 各回の詳細ページの「枝番号別 集計」 |
| 枝番表シート | Supabaseの `branch_master` テーブル（初期データとして移行済み） |

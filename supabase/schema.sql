-- 銘木市 枝番号別集計システム用スキーマ
-- Supabase の SQL Editor でこのファイルの内容をそのまま実行してください。

-- 1. 枝番マスタ
create table if not exists branch_master (
  branch_no integer primary key check (branch_no between 0 and 49),
  name text not null
);

insert into branch_master (branch_no, name) values
(0,'工場ナラ'), (1,'○お'), (2,'協和'), (3,'D ナラ'), (4,'S (サントリー）'),
(5,'シンエイ'), (6,'Z カバ'), (7,'K ナラ'), (8,'Q ナラ'), (9,'Q タモ'),
(10,'工場タモ'), (11,'田 (シラカワ）'), (12,'D クルミ'), (13,'D タモ'), (14,'D サクラ'),
(15,'I カバ'), (16,'SN ニレ'), (17,'M マンボウ'), (18,'○N 加工ニレ'), (19,'○天 天板'),
(20,'その他'), (21,'ST セン'), (22,'I セン'), (23,'T シナ'), (24,'H ヤマト'),
(25,'○大'), (26,'折笠商店'), (27,'YTS'), (28,'YTS'), (29,'YTS'),
(30,'マルケイ'), (31,'マルケイ'), (32,'CO カンディハウス'), (33,'アイダ B1'), (34,'アイダ B2'),
(35,'アートピア'), (36,'ZZ カバ'), (37,'G ニングル'), (38,'○も 扱い'), (39,'T セン'),
(40,'北央銘木'), (41,'○ト メジロ'), (42,'S タモ'), (43,'桜製作所'), (44,'工場Wオーク'),
(45,'斎藤大阪'), (46,'斎藤大阪'), (47,'斎藤大阪'), (48,'○小 小笠原工芸社'), (49,'斎藤 ツグ')
on conflict (branch_no) do update set name = excluded.name;

-- 2. 市場の回（開催日ごとに1レコード）
create table if not exists markets (
  id uuid primary key default gen_random_uuid(),
  market_date date not null,
  name text,
  created_at timestamptz not null default now()
);

-- 3. 入力明細（枝番号・材積）
create table if not exists entries (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references markets(id) on delete cascade,
  branch_no integer not null references branch_master(branch_no),
  volume numeric(10,3) not null check (volume >= 0),
  branch_name_snapshot text,
  created_at timestamptz not null default now()
);

-- 既存にentriesテーブルがある場合の追加カラム対応（初回作成時は無害）
alter table entries add column if not exists branch_name_snapshot text;

-- 既存明細で未設定のものは、現在の枝番表の名称で一度だけ埋める
-- （このマイグレーション適用時点までの過去データの名称を固定するための処理）
update entries e
set branch_name_snapshot = bm.name
from branch_master bm
where e.branch_no = bm.branch_no
  and e.branch_name_snapshot is null;

create index if not exists entries_market_id_idx on entries(market_id);
create index if not exists entries_branch_no_idx on entries(branch_no);

-- 4. RLS（社内共有URLでの利用を想定し、匿名キーでの読み書きを許可）
alter table branch_master enable row level security;
alter table markets enable row level security;
alter table entries enable row level security;

drop policy if exists "branch_master_select" on branch_master;
create policy "branch_master_select" on branch_master
  for select using (true);

drop policy if exists "markets_all" on markets;
create policy "markets_all" on markets
  for all using (true) with check (true);

drop policy if exists "entries_all" on entries;
create policy "entries_all" on entries
  for all using (true) with check (true);

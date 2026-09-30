# poster-map

福岡市内の公営ポスター掲示場の位置と貼り付け状況を共有する地図です。

- 閲覧: 公開期間中は誰でも見られます（地図・状況・件数のみ）。
- 報告: 参加コードを受け取ったボランティアが、ニックネームで状況を報告します。

ライセンスは GNU AGPL v3.0 です（`LICENSE`）。改変元と改変内容は `NOTICE.md` にあります。

## 開発

```bash
pnpm install
supabase start
supabase db reset          # migration と seed（ローカル専用の参加コード）を適用
cp .env.example .env.local # 値は `supabase status` とメモを見て埋める
pnpm dev
```

| コマンド | 内容 |
|---|---|
| `pnpm check` | lint・型チェック・ユニットテスト・名称チェック |
| `pnpm test:integration` | ローカル Supabase を使う統合テスト（RLS・RPC・取り込み） |
| `pnpm db:types` | DB の型を生成 |
| `pnpm import:boards [--dry-run] [--prune] [--include-removed] <csv>...` | 掲示板データの取り込み（`DATABASE_URL` が必要）。`--include-removed` は「削除」の行も含める |
| `pnpm reconcile:boards --senkan <csv> --out <csv> --report <md> [--base data/sangin-2025]` | 選管一覧との照合 |

## 運用

公開期間は DB の `private.site_settings` で管理します。緊急時の非表示:

```sql
update private.site_settings set force_hidden = true;
```

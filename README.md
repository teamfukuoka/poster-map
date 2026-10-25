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
| `pnpm test:integration` | ローカル Supabase を使う統合テスト（RLS・RPC・取り込み）。実行のたびにローカル DB の掲示板・参加者・参加コードを消して入れ直し、公開期間の設定も書き換える（seed の状態に戻すには `supabase db reset`） |
| `pnpm db:types` | DB の型を生成 |
| `pnpm import:boards [--dry-run] [--prune [--confirm-prune=<件数>]] [--include-removed] <csv>...` | 掲示板データの取り込み（`DATABASE_URL` が必要）。`--prune` は CSV にない掲示板を DB から消す（予約・報告の履歴も消える）。消える掲示板があるときは `--confirm-prune=<件数>` が要る（まず付けずに実行すると、DB を変えずに消える番号と件数を表示する）。`--include-removed` は「削除」の行も含める |
| `pnpm reconcile:boards --senkan <csv> --out <csv> --report <md> [--base data/sangin-2025]` | 選管一覧との照合。2026 年版の結果は `data/2026/boards.csv` |

### 管理画面（/admin）をローカルで開く

本番の管理画面は Google ログインで入ります。ローカルでは、パスワードの入り口を使います（ローカルの Supabase にだけ使えます）。

1. `.env.local` に次の2つを足します（名前と意味は `.env.example`）。
   - `APP_ORIGIN` — このサイトの origin。例: `http://localhost:3000`
   - `ADMIN_PASSWORD_LOGIN` — `local` にすると、ログイン画面にパスワードの入り口が出ます。本番（Vercel）には設定しません。
2. `supabase db reset` で seed を入れます。seed がローカル専用の管理者 `local-admin@example.invalid` を、管理者として一覧に登録します。
3. ローカル管理者を作ります。パスワードは 8 文字以上で、自分で決めた使い捨ての値にします。ファイルには書きません。

   ```bash
   LOCAL_ADMIN_PASSWORD=<自分で決めた使い捨ての値> pnpm admin:local
   ```

4. `pnpm dev` を起動して `http://localhost:3000/admin/login` を開き、「パスワードでログイン」に `local-admin@example.invalid` と手順 3 の値を入れます。

画面は「最初の画面」「参加コード」「公開とリセット」「操作の記録」の4つです（「公開とリセット」は管理者だけに出ます）。

## 運用

公開期間は DB の `private.site_settings` で管理します。緊急時の非表示:

```sql
update private.site_settings set force_hidden = true;
```

@AGENTS.md

# CLAUDE.md（poster-map）

- 流用元の名称は NOTICE.md 以外に書かない。`pnpm check` に名称チェックが入っている。
- 流用元から書き写したファイルには、先頭に `Derived from action-board (AGPL-3.0). See NOTICE.md. Modified 2026-10.` を付け、NOTICE.md の表に追加する。
- アプリに service role key を置かない。認可は migration の RLS と RPC で行う。DB を変えたら `pnpm test:integration` を通す。
- ブラウザから Supabase を呼ばない。サーバー（Server Actions / Route Handler）だけが呼ぶ。
- 地図のツールチップなど、HTML 文字列に入れる値は `escapeHtml` を通す。
- パスワード、API キー、参加コードを repo に書かない（`supabase/seed.sql` のローカル専用コードだけは例外）。
- push 前に `pnpm check` を通す。

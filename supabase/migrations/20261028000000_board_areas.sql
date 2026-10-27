-- 掲示場ごとの校区・町名（カバー地域の画面で、校区・町名ごとの数え上げに使う）。
-- 出典は福岡市教育委員会の通学区域一覧表。data/2026/README.md を見る。
-- API から見えないので grant はしない（読み書きは security definer の関数と取り込みスクリプトだけ）。
-- 番号の付け替え（poster_boards.number の更新）には on update cascade でついてくる。

create table private.board_areas (
  number text primary key references public.poster_boards (number) on update cascade on delete cascade,
  school text not null,
  school_source text not null check (school_source in ('pdf', 'map')),
  town text not null,
  chome text -- 丁目のない町名は null。数字だけ（'1'）
);

revoke all on private.board_areas from public, anon, authenticated;
alter table private.board_areas enable row level security;

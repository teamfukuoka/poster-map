-- ポスターシール貼りチャレンジ: 貼ったポスターにシールを貼る 2 回目の作業を、ポスターとは別の状態で記録する。
-- ・シールの状態は掲示場ごとに 1 つ（public.board_stickers）。行がない掲示場は「未」（not_yet）とみなす。
-- ・予約（reserved）と完了（done）にできるのは、ポスターが done の掲示場だけ。未と問題あり（issue）はいつでも。
-- ・シールの状態と履歴は、参加中のボランティアだけが読める（一般の人には見せない）。管理画面は関数で読む。
-- ・管理画面の「シールを始める」（private.admin_settings.sticker_enabled）が OFF の間は、報告も予約もできない。
-- 文字数の上限（メモ 500 字）と一括予約の上限（30 か所）は src/features/poster-map/limits.ts と揃えること。
-- 状態の一覧は src/features/poster-map/sticker-status.ts と揃える（型の一致は types.ts で検査）。

create type public.sticker_status as enum (
  'not_yet',
  'reserved',
  'done',
  'issue'
);

create table public.board_stickers (
  board_id uuid primary key references public.poster_boards (id) on delete cascade,
  status public.sticker_status not null default 'not_yet',
  updated_at timestamptz not null default now()
);

create table public.sticker_status_history (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.poster_boards (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  display_name text not null,
  previous_status public.sticker_status not null,
  new_status public.sticker_status not null,
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now()
);

create index sticker_status_history_board_idx
  on public.sticker_status_history (board_id, created_at desc);
create index sticker_status_history_user_idx
  on public.sticker_status_history (user_id);

alter table private.admin_settings
  add column sticker_enabled boolean not null default false;

-- 関数 ---------------------------------------------------------------

-- シールの報告を受け付けているか（地図で「ポスター｜シール」の切り替えを出すかに使う）
create function public.is_sticker_enabled()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select sticker_enabled from private.admin_settings), false);
$$;

-- 参加中のボランティアのニックネーム。参加していなければ例外
create function private.require_volunteer_name()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  select display_name into v_name
  from public.volunteers
  where user_id = (select auth.uid()) and revoked_at is null;

  if v_name is null then
    raise exception 'not_a_volunteer';
  end if;
  return v_name;
end;
$$;

create function public.update_sticker_status(
  p_board_id uuid,
  p_status public.sticker_status,
  p_note text default null
)
returns public.board_stickers
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_name text := private.require_volunteer_name();
  v_note text := nullif(private.trim_js(coalesce(p_note, '')), '');
  v_poster public.poster_board_status;
  v_previous public.sticker_status;
  v_row public.board_stickers;
begin
  if not public.is_sticker_enabled() then
    raise exception 'sticker_not_started';
  end if;

  if char_length(v_note) > 500 then
    raise exception 'note_too_long';
  end if;

  -- 掲示場の行ロックで、同じ掲示場のシールの報告（行がないときの insert も含む）を順番に処理する
  select status into v_poster
  from public.poster_boards
  where id = p_board_id
  for update;

  if not found then
    raise exception 'board_not_found';
  end if;

  if p_status in ('reserved', 'done') and v_poster <> 'done' then
    raise exception 'poster_not_done';
  end if;

  select status into v_previous
  from public.board_stickers
  where board_id = p_board_id;

  v_previous := coalesce(v_previous, 'not_yet');

  insert into public.board_stickers (board_id, status, updated_at)
  values (p_board_id, p_status, now())
  on conflict (board_id) do update
    set status = excluded.status, updated_at = excluded.updated_at
  returning * into v_row;

  insert into public.sticker_status_history
    (board_id, user_id, display_name, previous_status, new_status, note)
  values
    (p_board_id, v_uid, v_name, v_previous, p_status, v_note);

  return v_row;
end;
$$;

-- 自分のシールの予約の一覧。いま予約のままで、その掲示場の最後のシールの履歴が自分の予約であるもの
create function public.my_reserved_sticker_board_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.board_id
  from public.board_stickers s
  where s.status = 'reserved'
    and (select auth.uid()) is not null
    and (
      select h.user_id
      from public.sticker_status_history h
      where h.board_id = s.board_id
      order by h.created_at desc, h.id desc
      limit 1
    ) = (select auth.uid());
$$;

-- 渡された掲示場のうち、ポスターが done でシールが未のものだけを予約にする。予約にした掲示場の id を返す
create function public.reserve_stickers(p_board_ids uuid[])
returns setof uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_name text := private.require_volunteer_name();
  v_ids uuid[] := array(select distinct x from unnest(coalesce(p_board_ids, '{}')) x where x is not null);
begin
  if not public.is_sticker_enabled() then
    raise exception 'sticker_not_started';
  end if;

  if cardinality(v_ids) > 30 then
    raise exception 'too_many_boards';
  end if;

  -- update_sticker_status と同じく掲示場の行ロックを先に取る（順番を揃えて deadlock を避ける）
  perform 1
  from public.poster_boards
  where id = any(v_ids)
  order by id
  for update;

  return query
  with targets as (
    select b.id
    from public.poster_boards b
    left join public.board_stickers s on s.board_id = b.id
    where b.id = any(v_ids)
      and b.status = 'done'
      and coalesce(s.status, 'not_yet') = 'not_yet'
  ), updated as (
    insert into public.board_stickers (board_id, status, updated_at)
    select t.id, 'reserved', now()
    from targets t
    on conflict (board_id) do update
      set status = excluded.status, updated_at = excluded.updated_at
    returning board_id
  ), logged as (
    insert into public.sticker_status_history
      (board_id, user_id, display_name, previous_status, new_status, note)
    select u.board_id, v_uid, v_name, 'not_yet', 'reserved', null
    from updated u
  )
  select u.board_id from updated u;
end;
$$;

-- 自分のシールの予約を全部、未に戻す。戻した掲示場の id を返す（シールを止めたあとでも戻せる）
create function public.release_my_sticker_reservations()
returns setof uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_name text := private.require_volunteer_name();
  v_ids uuid[];
begin
  v_ids := array(select public.my_reserved_sticker_board_ids());

  perform 1
  from public.poster_boards
  where id = any(v_ids)
  order by id
  for update;

  -- ロックを待つ間にほかの人が報告していれば外す
  v_ids := array(select x from public.my_reserved_sticker_board_ids() x where x = any(v_ids));

  return query
  with updated as (
    update public.board_stickers
    set status = 'not_yet', updated_at = now()
    where board_id = any(v_ids) and status = 'reserved'
    returning board_id
  ), logged as (
    insert into public.sticker_status_history
      (board_id, user_id, display_name, previous_status, new_status, note)
    select u.board_id, v_uid, v_name, 'reserved', 'not_yet', null
    from updated u
  )
  select u.board_id from updated u;
end;
$$;

-- 管理画面 -------------------------------------------------------------

-- 「シールを始める」のスイッチ
create function public.admin_set_sticker_enabled(p_enabled boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor text;
begin
  v_actor := private.require_admin_role('admin');
  update private.admin_settings set sticker_enabled = coalesce(p_enabled, false) where id;
  perform private.write_audit(v_actor, 'set_sticker_enabled', coalesce(p_enabled, false)::text);
  return coalesce(p_enabled, false);
end;
$$;

-- 区ごとのシールの進み具合。対象はポスターが done の掲示場。
-- reserved・done・issue は、対象かどうかにかかわらずシールがその状態の掲示場の数
-- （シールを貼ったあとにポスターの状態が変わっても、数から消えないように）
create function public.admin_sticker_progress()
returns table (
  ward text,
  target int,
  reserved int,
  done int,
  issue int
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_admin_role('operator');
  return query
  select b.ward,
         (count(*) filter (where b.status = 'done'))::int,
         (count(*) filter (where s.status = 'reserved'))::int,
         (count(*) filter (where s.status = 'done'))::int,
         (count(*) filter (where s.status = 'issue'))::int
  from public.poster_boards b
  left join public.board_stickers s on s.board_id = b.id
  group by b.ward
  order by b.ward;
end;
$$;

-- 問題あり: シールが issue の掲示場と、その最新の報告（ポスターの貼り直しに回す）
create function public.admin_sticker_issues()
returns table (
  board_id uuid,
  number text,
  ward text,
  name text,
  poster_status public.poster_board_status,
  reported_at timestamptz,
  reported_by text,
  note text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_admin_role('operator');
  return query
  select b.id, b.number, b.ward, b.name, b.status, h.created_at, h.display_name, h.note
  from public.board_stickers s
  join public.poster_boards b on b.id = s.board_id
  left join lateral (
    select x.created_at, x.display_name, x.note
    from public.sticker_status_history x
    where x.board_id = s.board_id and x.new_status = 'issue'
    order by x.created_at desc, x.id desc
    limit 1
  ) h on true
  where s.status = 'issue'
  order by h.created_at desc nulls last, b.number;
end;
$$;

-- 権限 ---------------------------------------------------------------

revoke all on public.board_stickers, public.sticker_status_history from public, anon, authenticated;
grant select on public.board_stickers, public.sticker_status_history to authenticated;

revoke execute on function
  public.is_sticker_enabled(),
  private.require_volunteer_name(),
  public.update_sticker_status(uuid, public.sticker_status, text),
  public.my_reserved_sticker_board_ids(),
  public.reserve_stickers(uuid[]),
  public.release_my_sticker_reservations(),
  public.admin_set_sticker_enabled(boolean),
  public.admin_sticker_progress(),
  public.admin_sticker_issues()
  from public, anon, authenticated;
grant execute on function public.is_sticker_enabled() to anon, authenticated;
grant execute on function
  public.update_sticker_status(uuid, public.sticker_status, text),
  public.my_reserved_sticker_board_ids(),
  public.reserve_stickers(uuid[]),
  public.release_my_sticker_reservations(),
  public.admin_set_sticker_enabled(boolean),
  public.admin_sticker_progress(),
  public.admin_sticker_issues()
  to authenticated;

-- RLS ----------------------------------------------------------------

alter table public.board_stickers enable row level security;
alter table public.sticker_status_history enable row level security;

create policy "ボランティアはシールの状態を読める"
  on public.board_stickers for select
  to authenticated
  using ((select public.is_active_volunteer()));

create policy "ボランティアはシールの履歴を読める"
  on public.sticker_status_history for select
  to authenticated
  using ((select public.is_active_volunteer()));

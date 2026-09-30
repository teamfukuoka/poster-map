-- ポスター掲示板マップ
-- 認可はすべてこのファイルの RLS と security definer 関数で行う（アプリに service role key を置かない）。
-- 文字数の上限は src/features/poster-map/limits.ts と揃えること。

create extension if not exists pgcrypto with schema extensions;

-- ステータス（src/features/poster-map/status.ts と揃える。型の一致は types.ts で検査）
create type public.poster_board_status as enum (
  'not_yet',
  'not_yet_dangerous',
  'reserved',
  'done',
  'error_wrong_poster',
  'other'
);

create table public.poster_boards (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  name text not null,
  address text not null,
  ward text not null,
  lat double precision not null,
  long double precision not null,
  status public.poster_board_status not null default 'not_yet',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- API から見えない schema（参加コードと公開期間）
create schema private;
revoke all on schema private from public, anon, authenticated;

create table private.invite_codes (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  code_hash text not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table private.site_settings (
  id boolean primary key default true check (id),
  public_from timestamptz not null,
  public_until timestamptz not null,
  force_hidden boolean not null default false,
  check (public_from < public_until)
);

insert into private.site_settings (public_from, public_until)
values ('2026-11-01 12:00:00+09', '2026-11-14 23:55:00+09');

create table public.volunteers (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 20),
  invite_code_id uuid references private.invite_codes (id) on delete set null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

-- 参加コードの失敗の記録（総当たり対策）。register_volunteer だけが読み書きする。
-- ユーザーを消す（delete from auth.users）と一緒に消える
create table private.invite_code_failures (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index invite_code_failures_user_idx
  on private.invite_code_failures (user_id, created_at);

-- register_volunteer の戻り値。参加コードの誤りは例外にせず error で返す
-- （例外にすると rollback で失敗の記録まで消えるため）
create type public.register_volunteer_result as (
  display_name text,
  error text
);

create table public.poster_board_status_history (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.poster_boards (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  display_name text not null,
  previous_status public.poster_board_status not null,
  new_status public.poster_board_status not null,
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now()
);

create index poster_board_status_history_board_idx
  on public.poster_board_status_history (board_id, created_at desc);
create index poster_board_status_history_user_idx
  on public.poster_board_status_history (user_id);

-- 関数 ---------------------------------------------------------------

create function public.is_active_volunteer()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.volunteers
    where user_id = (select auth.uid())
      and revoked_at is null
  );
$$;

create function public.is_public_window()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select not force_hidden and now() >= public_from and now() < public_until
      from private.site_settings
    ),
    false
  );
$$;

-- 参加コードの試行は、1 ユーザーあたり 15 分に 5 回の失敗まで。
-- 上限に達したら bcrypt を計算する前に断る。
create function public.register_volunteer(p_code text, p_display_name text)
returns public.register_volunteer_result
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_name text := btrim(coalesce(p_display_name, ''));
  v_code_id uuid;
  v_row public.volunteers;
  v_result public.register_volunteer_result;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  -- 同じユーザーの同時の呼び出しを順番に処理し、並列で上限をすり抜けられないようにする
  perform pg_advisory_xact_lock(hashtextextended('register_volunteer:' || v_uid::text, 0));

  if (
    select count(*)
    from private.invite_code_failures
    where user_id = v_uid
      and created_at > now() - interval '15 minutes'
  ) >= 5 then
    raise exception 'too_many_attempts';
  end if;

  if char_length(v_name) < 1 or char_length(v_name) > 20 then
    raise exception 'invalid_display_name';
  end if;

  select id into v_code_id
  from private.invite_codes
  where revoked_at is null
    and code_hash = extensions.crypt(coalesce(p_code, ''), code_hash)
  limit 1;

  if v_code_id is null then
    -- 窓の外の古い記録はここで消す
    delete from private.invite_code_failures
    where user_id = v_uid
      and created_at <= now() - interval '15 minutes';
    insert into private.invite_code_failures (user_id) values (v_uid);
    v_result.error := 'invalid_invite_code';
    return v_result;
  end if;

  if exists (
    select 1 from public.volunteers
    where user_id = v_uid and revoked_at is not null
  ) then
    raise exception 'volunteer_revoked';
  end if;

  insert into public.volunteers (user_id, display_name, invite_code_id)
  values (v_uid, v_name, v_code_id)
  on conflict (user_id) do update set display_name = excluded.display_name
  returning * into v_row;

  delete from private.invite_code_failures where user_id = v_uid;

  v_result.display_name := v_row.display_name;
  return v_result;
end;
$$;

create function public.update_board_status(
  p_board_id uuid,
  p_status public.poster_board_status,
  p_note text default null
)
returns public.poster_boards
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_name text;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_previous public.poster_board_status;
  v_row public.poster_boards;
begin
  select display_name into v_name
  from public.volunteers
  where user_id = v_uid and revoked_at is null;

  if v_name is null then
    raise exception 'not_a_volunteer';
  end if;

  if char_length(v_note) > 500 then
    raise exception 'note_too_long';
  end if;

  select status into v_previous
  from public.poster_boards
  where id = p_board_id
  for update;

  if not found then
    raise exception 'board_not_found';
  end if;

  update public.poster_boards
  set status = p_status, updated_at = now()
  where id = p_board_id
  returning * into v_row;

  insert into public.poster_board_status_history
    (board_id, user_id, display_name, previous_status, new_status, note)
  values
    (p_board_id, v_uid, v_name, v_previous, p_status, v_note);

  return v_row;
end;
$$;

-- 権限 ---------------------------------------------------------------
-- Supabase は public schema の新しいテーブル・関数に anon / authenticated の権限を既定で付けるため、
-- いったん全部外してから必要なものだけ付ける。

revoke all on public.poster_boards, public.volunteers, public.poster_board_status_history
  from anon, authenticated;
grant select on public.poster_boards to anon, authenticated;
grant select on public.volunteers, public.poster_board_status_history to authenticated;

revoke execute on function
  public.is_active_volunteer(),
  public.is_public_window(),
  public.register_volunteer(text, text),
  public.update_board_status(uuid, public.poster_board_status, text)
  from public, anon, authenticated;
grant execute on function public.is_active_volunteer(), public.is_public_window()
  to anon, authenticated;
grant execute on function
  public.register_volunteer(text, text),
  public.update_board_status(uuid, public.poster_board_status, text)
  to authenticated;

-- private schema は anon / authenticated から使えないが、念のため表の権限も外して RLS を有効にする
revoke all on private.invite_code_failures from public, anon, authenticated;
alter table private.invite_code_failures enable row level security;

-- RLS ----------------------------------------------------------------

alter table public.poster_boards enable row level security;
alter table public.volunteers enable row level security;
alter table public.poster_board_status_history enable row level security;

create policy "掲示板の読み取り（公開中か参加者）"
  on public.poster_boards for select
  to anon, authenticated
  using ((select public.is_public_window()) or (select public.is_active_volunteer()));
comment on policy "掲示板の読み取り（公開中か参加者）" on public.poster_boards is '公開期間中は誰でも、ボランティアはいつでも掲示板を読める';

create policy "ボランティアは履歴を読める"
  on public.poster_board_status_history for select
  to authenticated
  using ((select public.is_active_volunteer()));

create policy "自分の参加情報だけ読める"
  on public.volunteers for select
  to authenticated
  using (user_id = (select auth.uid()));

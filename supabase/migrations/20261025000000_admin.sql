-- 管理画面（フェーズ1）
-- 認可はこのファイルの security definer 関数で行う。管理者の一覧・設定・操作の記録は private schema に置き、
-- ブラウザからは直接読めない（RPC 経由だけ）。
-- 後続のタスクが、この下に RPC を足していく（各節の見出しで区切る）。

-- 判定の土台 ---------------------------------------------------------

-- 管理者・運営の一覧。email は小文字で持つ（auth.users の email は lower して照合する）
create table private.admin_members (
  email text primary key check (email = lower(email)),
  role text not null check (role in ('admin', 'operator')),
  created_at timestamptz not null default now()
);

-- 管理画面の設定（1行だけ）
-- allowed_amr: 管理者として通すログイン方法（JWT の amr）。既定は Google などの OAuth だけ
-- rehearsal_reset_until: この日時までは、リハーサルの記録を消せる
-- stale_reserved_after: この日時を過ぎた「予約済み」を、古い予約として一覧に出す
create table private.admin_settings (
  id boolean primary key default true check (id),
  allowed_amr text[] not null default '{oauth}',
  rehearsal_reset_until timestamptz not null default '2026-11-01 00:00:00+09',
  stale_reserved_after timestamptz not null default '2026-11-01 14:00:00+09'
);

insert into private.admin_settings default values;

-- 管理画面での操作の記録
create table private.admin_audit_log (
  id bigint generated always as identity primary key,
  actor_email text not null,
  action text not null,
  target text,
  created_at timestamptz not null default now()
);

create index admin_audit_log_created_idx on private.admin_audit_log (created_at desc);

-- いまのユーザーの役割（admin / operator / null）。
-- 一覧に載っていて、メール確認済みで、匿名でなく、許可したログイン方法で入っている人だけ
create function private.admin_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select m.role
  from auth.users u
  join private.admin_members m on m.email = lower(u.email)
  cross join private.admin_settings s
  where u.id = auth.uid()
    and not coalesce(u.is_anonymous, false)
    and u.email_confirmed_at is not null
    and exists (
      select 1
      from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) a
      where a ->> 'method' = any (s.allowed_amr)
    );
$$;

-- 役割が足りなければ例外。通れば操作した人の email（小文字）を返す
create function private.require_admin_role(p_min text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_email text;
begin
  if auth.uid() is null then
    raise exception 'not_admin';
  end if;
  v_role := private.admin_role();
  if v_role is null then
    raise exception 'not_admin';
  end if;
  if p_min = 'admin' and v_role <> 'admin' then
    raise exception 'forbidden';
  end if;
  select lower(email) into v_email from auth.users where id = auth.uid();
  return v_email;
end;
$$;

create function private.write_audit(p_actor text, p_action text, p_target text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into private.admin_audit_log (actor_email, action, target)
  values (p_actor, p_action, p_target);
$$;

-- 画面が出し分けるための役割。一覧にない人は例外にせず null を返す
create function public.admin_whoami()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select private.admin_role();
$$;

-- 操作の記録（運営も読める・新しい順に100件）
create function public.admin_recent_audit_log()
returns table (
  id bigint,
  actor_email text,
  action text,
  target text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_admin_role('operator');
  return query
  select l.id, l.actor_email, l.action, l.target, l.created_at
  from private.admin_audit_log l
  order by l.created_at desc, l.id desc
  limit 100;
end;
$$;

-- 権限（判定の土台） --------------------------------------------------
-- private の関数は public の RPC からだけ呼ぶ（authenticated に execute を付けない）

revoke all on private.admin_members, private.admin_settings, private.admin_audit_log
  from public, anon, authenticated;
alter table private.admin_members enable row level security;
alter table private.admin_settings enable row level security;
alter table private.admin_audit_log enable row level security;

revoke execute on function
  private.admin_role(),
  private.require_admin_role(text),
  private.write_audit(text, text, text)
  from public, anon, authenticated;

revoke execute on function
  public.admin_whoami(),
  public.admin_recent_audit_log()
  from public, anon, authenticated;
grant execute on function
  public.admin_whoami(),
  public.admin_recent_audit_log()
  to authenticated;

-- 最初の画面（読むだけ・運営も読める・操作の記録は残さない） -----------------

-- 長い予約: 予約のまま6時間以上動いていない掲示場。stale_reserved_after より前は出さない
-- （告示前のリハーサルの予約を、本番の「長い予約」に混ぜないため）。
-- reserved_by は、その掲示場で最後に reserved にした人のニックネーム（履歴がなければ null）
create function public.admin_stale_reservations()
returns table (
  board_id uuid,
  number text,
  ward text,
  name text,
  reserved_at timestamptz,
  reserved_by text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_admin_role('operator');
  return query
  select b.id, b.number, b.ward, b.name, b.updated_at, h.display_name
  from public.poster_boards b
  cross join private.admin_settings s
  left join lateral (
    select x.display_name
    from public.poster_board_status_history x
    where x.board_id = b.id and x.new_status = 'reserved'
    order by x.created_at desc, x.id desc
    limit 1
  ) h on true
  where b.status = 'reserved'
    and now() >= s.stale_reserved_after
    and b.updated_at <= now() - interval '6 hours'
  order by b.updated_at, b.number;
end;
$$;

-- 危険: 「危険で行けていない」の掲示場と、その最新の報告
create function public.admin_dangerous_boards()
returns table (
  board_id uuid,
  number text,
  ward text,
  name text,
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
  select b.id, b.number, b.ward, b.name, h.created_at, h.display_name, h.note
  from public.poster_boards b
  left join lateral (
    select x.created_at, x.display_name, x.note
    from public.poster_board_status_history x
    where x.board_id = b.id and x.new_status = 'not_yet_dangerous'
    order by x.created_at desc, x.id desc
    limit 1
  ) h on true
  where b.status = 'not_yet_dangerous'
  order by h.created_at desc nulls last, b.number;
end;
$$;

-- 新しい連絡事項: 直近24時間の、連絡事項つき・他候補のポスター・その他の報告。
-- user_id は「この人を止める」で使う
create function public.admin_recent_reports()
returns table (
  history_id uuid,
  board_id uuid,
  number text,
  ward text,
  user_id uuid,
  display_name text,
  previous_status public.poster_board_status,
  new_status public.poster_board_status,
  note text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_admin_role('operator');
  return query
  select h.id, h.board_id, b.number, b.ward, h.user_id, h.display_name,
         h.previous_status, h.new_status, h.note, h.created_at
  from public.poster_board_status_history h
  join public.poster_boards b on b.id = h.board_id
  where h.created_at >= now() - interval '24 hours'
    and (h.note is not null or h.new_status in ('error_wrong_poster', 'other'))
  order by h.created_at desc, h.id desc;
end;
$$;

-- 区ごとの進み具合（並びは画面が WARDS の順に直す）
create function public.admin_ward_progress()
returns table (
  ward text,
  total int,
  done int,
  reserved int
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
         count(*)::int,
         (count(*) filter (where b.status = 'done'))::int,
         (count(*) filter (where b.status = 'reserved'))::int
  from public.poster_boards b
  group by b.ward
  order by b.ward;
end;
$$;

-- 公開の状態。is_public は public.is_public_window() と同じ判定
create function public.admin_site_state()
returns table (
  public_from timestamptz,
  public_until timestamptz,
  force_hidden boolean,
  is_public boolean,
  rehearsal_reset_until timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_admin_role('operator');
  return query
  select ss.public_from, ss.public_until, ss.force_hidden,
         public.is_public_window(), a.rehearsal_reset_until
  from private.site_settings ss
  cross join private.admin_settings a;
end;
$$;

revoke execute on function
  public.admin_stale_reservations(),
  public.admin_dangerous_boards(),
  public.admin_recent_reports(),
  public.admin_ward_progress(),
  public.admin_site_state()
  from public, anon, authenticated;
grant execute on function
  public.admin_stale_reservations(),
  public.admin_dangerous_boards(),
  public.admin_recent_reports(),
  public.admin_ward_progress(),
  public.admin_site_state()
  to authenticated;

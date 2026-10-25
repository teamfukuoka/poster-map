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

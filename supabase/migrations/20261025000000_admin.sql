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

-- 公開の切り替え・リハーサルのまとめ戻し（管理者だけ） -------------------------

-- 公開を止める／再開する。公開期間そのものは変えず、force_hidden だけを切り替える
create function public.admin_set_force_hidden(p_hidden boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor text;
begin
  v_actor := private.require_admin_role('admin');
  update private.site_settings set force_hidden = p_hidden where id;
  perform private.write_audit(v_actor, 'set_force_hidden', p_hidden::text);
end;
$$;

-- リハーサルの記録をまとめて戻す。履歴をすべて消し、全掲示場を「まだ」に戻す。
-- 締切（rehearsal_reset_until）を過ぎたら、確認の文字に関係なく reset_closed で断る（判定は確認より先）
create function public.admin_reset_rehearsal(p_confirm text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor text;
  v_deleted int;
begin
  v_actor := private.require_admin_role('admin');
  -- 設定の行がなければ締切を過ぎたものとして断る
  if now() >= coalesce(
    (select s.rehearsal_reset_until from private.admin_settings s),
    '-infinity'::timestamptz
  ) then
    raise exception 'reset_closed';
  end if;
  if p_confirm is distinct from 'リセット' then
    raise exception 'confirm_mismatch';
  end if;
  -- 先に掲示場を更新する。操作中の update_board_status が持つ掲示場の行ロックをここで待つので、
  -- その後の delete は、その操作が確定させた履歴も見える（順序を逆にすると履歴が残りうる）
  update public.poster_boards set status = 'not_yet', updated_at = now() where true;
  with d as (
    delete from public.poster_board_status_history where true returning 1
  )
  select count(*)::int into v_deleted from d;
  perform private.write_audit(v_actor, 'reset_rehearsal', v_deleted::text);
end;
$$;

revoke execute on function
  public.admin_set_force_hidden(boolean),
  public.admin_reset_rehearsal(text)
  from public, anon, authenticated;
grant execute on function
  public.admin_set_force_hidden(boolean),
  public.admin_reset_rehearsal(text)
  to authenticated;

-- 参加コードの登録・表示・失効・人数 ------------------------------------------

-- 運用のため、平文を private schema（API から見えない）に置き、管理画面で後から見られるようにする。
-- null は、以前の方法（psql）で登録したコード。平文がないので表示できない
alter table private.invite_codes add column code_plain text;

-- 参加の照合で、コードの前後の空白（全角の空白・改行も）を落とす。ほかは元の migration のまま
create or replace function public.register_volunteer(p_code text, p_display_name text)
returns public.register_volunteer_result
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_name text := private.trim_js(coalesce(p_display_name, ''));
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
    and code_hash = extensions.crypt(private.trim_js(coalesce(p_code, '')), code_hash)
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

-- 参加コードごとの人数（運営も読める）。code_hash・code_plain は返さない
create function public.admin_list_invite_codes()
returns table (
  id uuid,
  label text,
  created_at timestamptz,
  revoked_at timestamptz,
  has_code boolean,
  volunteers int,
  active_volunteers int
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_admin_role('operator');
  return query
  select c.id, c.label, c.created_at, c.revoked_at, c.code_plain is not null,
         (count(v.user_id))::int,
         (count(v.user_id) filter (where v.revoked_at is null))::int
  from private.invite_codes c
  left join public.volunteers v on v.invite_code_id = c.id
  group by c.id
  order by c.created_at desc, c.id;
end;
$$;

-- 登録した値を見る（運営も）。押したときだけ取り、記録には label だけ残す。
-- 失効済みも返す（もれたコードの確認に使う）。以前のコードは null
create function public.admin_reveal_invite_code(p_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor text;
  v_label text;
  v_plain text;
begin
  v_actor := private.require_admin_role('operator');
  select c.label, c.code_plain into v_label, v_plain
  from private.invite_codes c
  where c.id = p_id;
  if not found then
    raise exception 'invite_code_not_found';
  end if;
  perform private.write_audit(v_actor, 'reveal_invite_code', v_label);
  return v_plain;
end;
$$;

-- 管理者が作ったコードを、配布先の名前と一緒に登録する（管理画面ではコードを作らない）
create function public.admin_register_invite_code(p_label text, p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor text;
  v_code text := private.trim_js(coalesce(p_code, ''));
  v_label text := private.trim_js(coalesce(p_label, ''));
  v_id uuid;
begin
  v_actor := private.require_admin_role('admin');
  if char_length(v_code) not between 8 and 64
     or v_code !~ '^[!-~]+$'
     or v_code !~ '[A-Za-z]'
     or v_code !~ '[0-9]'
     or v_code !~ '[^A-Za-z0-9]' then
    raise exception 'invalid_invite_code_format';
  end if;
  if char_length(v_label) not between 1 and 50 then
    raise exception 'invalid_label';
  end if;
  -- 平文のない以前のコードもあるので、ハッシュでも照合する
  if exists (
    select 1
    from private.invite_codes c
    where c.revoked_at is null
      and (c.code_plain = v_code or c.code_hash = extensions.crypt(v_code, c.code_hash))
  ) then
    raise exception 'duplicate_invite_code';
  end if;
  insert into private.invite_codes (label, code_hash, code_plain)
  values (v_label, extensions.crypt(v_code, extensions.gen_salt('bf')), v_code)
  returning id into v_id;
  perform private.write_audit(v_actor, 'register_invite_code', v_label);
  return v_id;
end;
$$;

-- コードを失効させる。p_revoke_volunteers なら、そのコードで参加した人もまとめて止め、止めた人数を返す
create function public.admin_revoke_invite_code(p_id uuid, p_revoke_volunteers boolean)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor text;
  v_label text;
  v_count int := 0;
begin
  v_actor := private.require_admin_role('admin');
  update private.invite_codes
  set revoked_at = now()
  where id = p_id and revoked_at is null
  returning label into v_label;
  if not found then
    raise exception 'invite_code_not_found';
  end if;
  if p_revoke_volunteers then
    with r as (
      update public.volunteers
      set revoked_at = now()
      where invite_code_id = p_id and revoked_at is null
      returning 1
    )
    select count(*)::int into v_count from r;
  end if;
  perform private.write_audit(
    v_actor, 'revoke_invite_code', v_label || '（止めた人数: ' || v_count || '）'
  );
  return v_count;
end;
$$;

revoke execute on function
  public.admin_list_invite_codes(),
  public.admin_reveal_invite_code(uuid),
  public.admin_register_invite_code(text, text),
  public.admin_revoke_invite_code(uuid, boolean)
  from public, anon, authenticated;
grant execute on function
  public.admin_list_invite_codes(),
  public.admin_reveal_invite_code(uuid),
  public.admin_register_invite_code(text, text),
  public.admin_revoke_invite_code(uuid, boolean)
  to authenticated;

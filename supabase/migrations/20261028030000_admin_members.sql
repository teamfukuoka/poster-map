-- 管理メンバー: 管理画面に入れる人（private.admin_members）を、管理画面から見る・足す・外す
-- どれも管理者だけ。自分自身は外せない（だれも入れなくなるのを防ぐ。外す人が管理者なので、管理者は必ず1人残る）

-- 一覧。last_sign_in_at は同じメールの（匿名でない）ユーザーが最後にログインした日時で、まだなら null。
-- is_self は操作している本人の行
create function public.admin_list_members()
returns table (
  email text,
  role text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  is_self boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor text;
begin
  v_actor := private.require_admin_role('admin');
  return query
  select m.email, m.role, m.created_at, u.last_sign_in_at, m.email = v_actor
  from private.admin_members m
  left join lateral (
    select max(x.last_sign_in_at) as last_sign_in_at
    from auth.users x
    where lower(x.email) = m.email and not coalesce(x.is_anonymous, false)
  ) u on true
  order by (m.role = 'admin') desc, m.created_at, m.email;
end;
$$;

-- 足す。メールは全角を半角にし、前後の空白を落として小文字にそろえる
create function public.admin_add_member(p_email text, p_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor text;
  v_email text;
begin
  v_actor := private.require_admin_role('admin');
  v_email := lower(private.trim_js(normalize(coalesce(p_email, ''), nfkc)));
  if char_length(v_email) > 254
     or v_email !~ '^[!-~]+$'
     or v_email !~ '^[^@]+@[^@]+\.[^@]+$' then
    raise exception 'invalid_member_email';
  end if;
  if p_role is null or p_role not in ('admin', 'operator') then
    raise exception 'invalid_member_role';
  end if;
  insert into private.admin_members (email, role)
  values (v_email, p_role)
  on conflict (email) do nothing;
  if not found then
    raise exception 'duplicate_member';
  end if;
  perform private.write_audit(
    v_actor,
    'add_admin_member',
    v_email || '（' || case p_role when 'admin' then '管理者' else '運営' end || '）'
  );
end;
$$;

-- 外す。外した人は次の呼び出しから管理画面に入れない（admin_role が一覧を引く）
create function public.admin_remove_member(p_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor text;
  v_email text;
begin
  -- 管理者どうしが同時に外し合って、だれも残らないことがないよう、外す操作を順番に処理する。
  -- 役割は待ったあとで確かめる（先に外された人は not_admin になる）
  perform pg_advisory_xact_lock(hashtextextended('admin_remove_member', 0));
  v_actor := private.require_admin_role('admin');
  v_email := lower(private.trim_js(coalesce(p_email, '')));
  if v_email = v_actor then
    raise exception 'cannot_remove_self';
  end if;
  delete from private.admin_members m where m.email = v_email;
  if not found then
    raise exception 'member_not_found';
  end if;
  perform private.write_audit(v_actor, 'remove_admin_member', v_email);
end;
$$;

revoke execute on function
  public.admin_list_members(),
  public.admin_add_member(text, text),
  public.admin_remove_member(text)
  from public, anon, authenticated;
grant execute on function
  public.admin_list_members(),
  public.admin_add_member(text, text),
  public.admin_remove_member(text)
  to authenticated;

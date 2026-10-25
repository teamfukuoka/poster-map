-- サイト名を DB に持たせ、「公開する」で受理前の名前から受理後の名前に切り替える。
-- 公開は告示前から force_hidden を ON にしておき、立候補の届出の受理を確かめてから管理画面の「公開する」で出す。
-- 緊急停止して再開しても、受理後の名前は戻らない（accepted_at は止める・再開では変わらない）。
-- 公開期間（public_from / public_until）と force_hidden の値は、この migration では変えない。

-- 設定 ---------------------------------------------------------------

-- accepted_at: 受理を確かめて「公開する」を押した日時。null は受理前
alter table private.site_settings
  add column site_name_before text not null default '福岡市ポスター掲示板マップ',
  add column site_name_after text not null default '佐々木あやの ポスター掲示板マップ',
  add column accepted_at timestamptz;

-- 公開の画面のヘッダー・タイトルで使う名前（anon も読める）。
-- 受理前は受理前の名前だけを返す。受理後の名前を返す経路は accepted_at が入ったあとだけ
create function public.current_site_name()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select case when s.accepted_at is null then s.site_name_before else s.site_name_after end
      from private.site_settings s
    ),
    '福岡市ポスター掲示板マップ'
  );
$$;

revoke execute on function public.current_site_name() from public, anon, authenticated;
grant execute on function public.current_site_name() to anon, authenticated;

-- 公開の状態（読むだけ・運営も読める）。受理の日時と今のサイト名も返す
drop function public.admin_site_state();
create function public.admin_site_state()
returns table (
  public_from timestamptz,
  public_until timestamptz,
  force_hidden boolean,
  is_public boolean,
  rehearsal_reset_until timestamptz,
  accepted_at timestamptz,
  site_name text
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
         public.is_public_window(), a.rehearsal_reset_until,
         ss.accepted_at, public.current_site_name()
  from private.site_settings ss
  cross join private.admin_settings a;
end;
$$;

revoke execute on function public.admin_site_state() from public, anon, authenticated;
grant execute on function public.admin_site_state() to authenticated;

-- 公開・停止・受理前に戻す（管理者だけ） ---------------------------------------

-- 「公開する」: 受理を確かめたうえで公開し、サイト名を受理後の名前にする。
-- 確認の文字の判定が先、その次に公開期間の始まり。受理の日時は最初に押した日時のまま残す
create function public.admin_publish(p_confirm text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor text;
  v_from timestamptz;
  v_name text;
begin
  v_actor := private.require_admin_role('admin');
  if p_confirm is distinct from '公開する' then
    raise exception 'confirm_mismatch';
  end if;
  -- 止める・戻す操作と同時に走っても順番に処理する
  select s.public_from into v_from from private.site_settings s where s.id for update;
  -- 設定の行がなければ、公開期間の前として断る
  if now() < coalesce(v_from, 'infinity'::timestamptz) then
    raise exception 'before_public_from';
  end if;
  update private.site_settings
  set accepted_at = coalesce(accepted_at, now()), force_hidden = false
  where id;
  v_name := public.current_site_name();
  perform private.write_audit(v_actor, 'publish', v_name);
end;
$$;

-- 公開を止める／再開する。公開期間そのものは変えず、force_hidden だけを切り替える。
-- 受理前の再開は「公開する」からだけ（止めるのはいつでもできる）
create or replace function public.admin_set_force_hidden(p_hidden boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor text;
  v_accepted timestamptz;
begin
  v_actor := private.require_admin_role('admin');
  if p_hidden = false then
    select s.accepted_at into v_accepted from private.site_settings s where s.id for update;
    if v_accepted is null then
      raise exception 'not_accepted';
    end if;
  end if;
  update private.site_settings set force_hidden = p_hidden where id;
  perform private.write_audit(v_actor, 'set_force_hidden', p_hidden::text);
end;
$$;

-- 押し間違いの戻し用。サイト名を受理前の名前に戻し、公開を止める
create function public.admin_revert_acceptance(p_confirm text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor text;
begin
  v_actor := private.require_admin_role('admin');
  if p_confirm is distinct from '受理前に戻す' then
    raise exception 'confirm_mismatch';
  end if;
  update private.site_settings set accepted_at = null, force_hidden = true where id;
  perform private.write_audit(v_actor, 'revert_acceptance', null);
end;
$$;

revoke execute on function
  public.admin_publish(text),
  public.admin_revert_acceptance(text)
  from public, anon, authenticated;
grant execute on function
  public.admin_publish(text),
  public.admin_revert_acceptance(text)
  to authenticated;

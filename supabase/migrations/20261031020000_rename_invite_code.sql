-- 参加コードの配布先の名前を直す（管理者だけ）。コードそのものは変えない。
-- 失効済みのコードも直せる（記録を読みやすくするため）。記録には「前 → 後」を残す
create function public.admin_rename_invite_code(p_id uuid, p_label text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor text;
  v_label text := private.trim_js(coalesce(p_label, ''));
  v_old text;
begin
  v_actor := private.require_admin_role('admin');
  if char_length(v_label) not between 1 and 50 then
    raise exception 'invalid_label';
  end if;
  select c.label into v_old
  from private.invite_codes c
  where c.id = p_id
  for update;
  if not found then
    raise exception 'invite_code_not_found';
  end if;
  if v_old = v_label then
    return;
  end if;
  update private.invite_codes set label = v_label where id = p_id;
  perform private.write_audit(v_actor, 'rename_invite_code', v_old || ' → ' || v_label);
end;
$$;

revoke execute on function public.admin_rename_invite_code(uuid, text)
  from public, anon, authenticated;
grant execute on function public.admin_rename_invite_code(uuid, text) to authenticated;

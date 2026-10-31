-- 投票区の掲示場をまとめて予約する・自分の予約をまとめて未貼付に戻す。
-- 予約は時間がたっても消えないので、まとめて戻す操作と、一度に予約できる数の上限（30 か所）をセットにする。
-- 上限は src/features/poster-map/limits.ts の BULK_RESERVE_MAX と揃えること。
-- 「自分の予約」は、いま予約のままで、その掲示場の最後の履歴が自分の予約であるもの。

-- 自分の予約の一覧（まとめて戻すボタンの件数に使う）
create function public.my_reserved_board_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select b.id
  from public.poster_boards b
  where b.status = 'reserved'
    and (select auth.uid()) is not null
    and (
      select h.user_id
      from public.poster_board_status_history h
      where h.board_id = b.id
      order by h.created_at desc, h.id desc
      limit 1
    ) = (select auth.uid());
$$;

-- 渡された掲示場のうち、未貼付のものだけを予約にする。予約・完了などになっていた掲示場はそのまま。
-- 予約にした掲示場を返す（ほかの人が先に報告していれば、渡した数より少なくなる）
create function public.reserve_boards(p_board_ids uuid[])
returns setof public.poster_boards
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_name text;
  v_ids uuid[] := array(select distinct x from unnest(coalesce(p_board_ids, '{}')) x where x is not null);
begin
  select display_name into v_name
  from public.volunteers
  where user_id = v_uid and revoked_at is null;

  if v_name is null then
    raise exception 'not_a_volunteer';
  end if;

  if cardinality(v_ids) > 30 then
    raise exception 'too_many_boards';
  end if;

  -- 同時に報告している人と食い違わないよう、先に行ロックを取る（順番を揃えて deadlock を避ける）。
  -- 次の文は新しいスナップショットで読むので、待っている間に確定した報告も見える
  perform 1
  from public.poster_boards
  where id = any(v_ids)
  order by id
  for update;

  return query
  with updated as (
    update public.poster_boards
    set status = 'reserved', updated_at = now()
    where id = any(v_ids) and status = 'not_yet'
    returning *
  ), logged as (
    insert into public.poster_board_status_history
      (board_id, user_id, display_name, previous_status, new_status, note)
    select u.id, v_uid, v_name, 'not_yet', 'reserved', null
    from updated u
  )
  select * from updated;
end;
$$;

-- 自分の予約を全部、未貼付に戻す。戻した掲示場を返す
create function public.release_my_reservations()
returns setof public.poster_boards
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_name text;
  v_ids uuid[];
begin
  select display_name into v_name
  from public.volunteers
  where user_id = v_uid and revoked_at is null;

  if v_name is null then
    raise exception 'not_a_volunteer';
  end if;

  v_ids := array(select public.my_reserved_board_ids());

  -- 行ロックを取ってから、自分の予約のままかを読み直す（待っている間にほかの人が報告していれば外す）
  perform 1
  from public.poster_boards
  where id = any(v_ids)
  order by id
  for update;

  v_ids := array(select x from public.my_reserved_board_ids() x where x = any(v_ids));

  return query
  with updated as (
    update public.poster_boards
    set status = 'not_yet', updated_at = now()
    where id = any(v_ids) and status = 'reserved'
    returning *
  ), logged as (
    insert into public.poster_board_status_history
      (board_id, user_id, display_name, previous_status, new_status, note)
    select u.id, v_uid, v_name, 'reserved', 'not_yet', null
    from updated u
  )
  select * from updated;
end;
$$;

revoke execute on function
  public.my_reserved_board_ids(),
  public.reserve_boards(uuid[]),
  public.release_my_reservations()
  from public, anon, authenticated;
grant execute on function
  public.my_reserved_board_ids(),
  public.reserve_boards(uuid[]),
  public.release_my_reservations()
  to authenticated;

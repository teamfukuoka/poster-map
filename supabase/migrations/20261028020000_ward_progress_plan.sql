-- 最初の画面の「区ごとの進み具合」を、計画（担当あり＋予約あり）と実績（完了）にする。
-- 計画は private.board_coverage() が assigned か reserved の掲示場。実績は status が done の掲示場。
-- 戻り値の形が変わるので、いったん消して作り直し、権限を付け直す。

drop function public.admin_ward_progress();

create function public.admin_ward_progress()
returns table (
  ward text,
  total int,
  planned int,
  done int
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
         (count(*) filter (where c.coverage in ('assigned', 'reserved')))::int,
         (count(*) filter (where b.status = 'done'))::int
  from public.poster_boards b
  join private.board_coverage() c on c.board_id = b.id
  group by b.ward
  order by b.ward;
end;
$$;

revoke execute on function public.admin_ward_progress() from public, anon, authenticated;
grant execute on function public.admin_ward_progress() to authenticated;

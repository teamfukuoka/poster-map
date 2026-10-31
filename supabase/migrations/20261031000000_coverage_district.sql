-- カバー地域に投票区を足す。投票区は掲示場の番号の最後の「-数字」より前（例: 馬出第一-3 は 馬出第一）。
-- 投票区は区の中で決まるので、範囲は町名と同じく ward と district の 2 つで持つ。
-- 集計と掲示場の一覧は戻り値の形が変わるので、いったん消して作り直し、権限を付け直す。

-- 番号から投票区。形が違う番号（「-数字」で終わらない）は null
create function private.board_district(p_number text)
returns text
language sql
immutable
set search_path = ''
as $$
  select substring(p_number from '^(.+)-[0-9]+$');
$$;

-- 範囲 ---------------------------------------------------------------

alter table private.coverage_ranges add column district text;

alter table private.coverage_ranges
  drop constraint coverage_ranges_kind_check,
  drop constraint coverage_ranges_check,
  drop constraint coverage_ranges_check1;

-- kind ごとに使う列: ward: ward / district: ward・district / school: school / town: ward・town / chome: ward・town・chome
alter table private.coverage_ranges
  add constraint coverage_ranges_kind_check
    check (kind in ('ward', 'district', 'school', 'town', 'chome')),
  add constraint coverage_ranges_not_empty
    check (coalesce(ward, 'x') <> '' and coalesce(district, 'x') <> ''
      and coalesce(school, 'x') <> '' and coalesce(town, 'x') <> ''
      and coalesce(chome, 'x') <> ''),
  add constraint coverage_ranges_columns check (
    (kind = 'ward' and ward is not null
      and district is null and school is null and town is null and chome is null)
    or (kind = 'district' and ward is not null and district is not null
      and school is null and town is null and chome is null)
    or (kind = 'school' and school is not null
      and ward is null and district is null and town is null and chome is null)
    or (kind = 'town' and ward is not null and town is not null
      and district is null and school is null and chome is null)
    or (kind = 'chome' and ward is not null and town is not null and chome is not null
      and district is null and school is null)
  );

-- 判定 ---------------------------------------------------------------

create or replace function private.board_coverage()
returns table (board_id uuid, coverage text, assignee_ids uuid[])
language sql
stable
security definer
set search_path = ''
as $$
  select b.id,
         case
           when m.ids is not null then 'assigned'
           when b.status in ('reserved', 'done') then 'reserved'
           else 'none'
         end,
         coalesce(m.ids, '{}'::uuid[])
  from public.poster_boards b
  left join private.board_areas a on a.number = b.number
  left join lateral (
    select array_agg(distinct r.assignee_id order by r.assignee_id) as ids
    from private.coverage_ranges r
    where (r.kind = 'ward' and r.ward = b.ward)
       or (r.kind = 'district' and r.ward = b.ward and r.district = private.board_district(b.number))
       or (r.kind = 'school' and r.school = a.school)
       or (r.kind = 'town' and r.ward = b.ward and r.town = a.town)
       or (r.kind = 'chome' and r.ward = b.ward and r.town = a.town and r.chome = a.chome)
  ) m on true;
$$;

-- 入力の確認 ----------------------------------------------------------

-- 範囲の jsonb を 1 つずつ確かめて、重なりなしにそろえた jsonb の配列
-- （[{kind, ward, district, school, town, chome}]・使わない項目は null）にして返す。
-- 先に全部の形を見て（invalid_coverage_ranges）、そのあとで地名が掲示場のデータにあるかを見る（unknown_coverage_place）
create or replace function private.parse_coverage_ranges(p_ranges jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_el jsonb;
  v_key text;
  v_val jsonb;
  v_kind text;
  v_use text[];
  v_out jsonb := '[]'::jsonb;
  v_row record;
  v_found boolean;
begin
  if p_ranges is null or jsonb_typeof(p_ranges) <> 'array' or jsonb_array_length(p_ranges) = 0 then
    raise exception 'invalid_coverage_ranges';
  end if;

  for v_el in select e from jsonb_array_elements(p_ranges) e loop
    if jsonb_typeof(v_el) <> 'object' then
      raise exception 'invalid_coverage_ranges';
    end if;
    -- 知らない項目は、値が入っていたら不正（null は許す）
    for v_key, v_val in select k, v from jsonb_each(v_el) x(k, v) loop
      if v_key not in ('kind', 'ward', 'district', 'school', 'town', 'chome')
         and jsonb_typeof(v_val) <> 'null' then
        raise exception 'invalid_coverage_ranges';
      end if;
    end loop;
    if jsonb_typeof(v_el -> 'kind') is distinct from 'string' then
      raise exception 'invalid_coverage_ranges';
    end if;
    v_kind := v_el ->> 'kind';
    v_use := case v_kind
      when 'ward' then array['ward']
      when 'district' then array['ward', 'district']
      when 'school' then array['school']
      when 'town' then array['ward', 'town']
      when 'chome' then array['ward', 'town', 'chome']
      else null
    end;
    if v_use is null then
      raise exception 'invalid_coverage_ranges';
    end if;
    -- 使う項目は空でない文字列、使わない項目は付いていないか null
    foreach v_key in array array['ward', 'district', 'school', 'town', 'chome'] loop
      v_val := v_el -> v_key;
      if v_key = any (v_use) then
        if jsonb_typeof(v_val) is distinct from 'string' or (v_el ->> v_key) = '' then
          raise exception 'invalid_coverage_ranges';
        end if;
      elsif v_val is not null and jsonb_typeof(v_val) <> 'null' then
        raise exception 'invalid_coverage_ranges';
      end if;
    end loop;
    v_out := v_out || jsonb_build_array(jsonb_build_object(
      'kind', v_kind,
      'ward', case when 'ward' = any (v_use) then v_el ->> 'ward' end,
      'district', case when 'district' = any (v_use) then v_el ->> 'district' end,
      'school', case when 'school' = any (v_use) then v_el ->> 'school' end,
      'town', case when 'town' = any (v_use) then v_el ->> 'town' end,
      'chome', case when 'chome' = any (v_use) then v_el ->> 'chome' end
    ));
  end loop;

  -- 同じ範囲は 1 つにまとめる
  select coalesce(jsonb_agg(to_jsonb(d)), '[]'::jsonb) into v_out
  from (
    select distinct x.kind, x.ward, x.district, x.school, x.town, x.chome
    from jsonb_to_recordset(v_out)
      as x(kind text, ward text, district text, school text, town text, chome text)
  ) d;

  -- 地名が掲示場のデータにあるか
  for v_row in
    select x.kind, x.ward, x.district, x.school, x.town, x.chome
    from jsonb_to_recordset(v_out)
      as x(kind text, ward text, district text, school text, town text, chome text)
  loop
    if v_row.kind = 'ward' then
      v_found := exists (select 1 from public.poster_boards b where b.ward = v_row.ward);
    elsif v_row.kind = 'district' then
      v_found := exists (
        select 1 from public.poster_boards b
        where b.ward = v_row.ward and private.board_district(b.number) = v_row.district
      );
    elsif v_row.kind = 'school' then
      v_found := exists (select 1 from private.board_areas a where a.school = v_row.school);
    elsif v_row.kind = 'town' then
      v_found := exists (
        select 1 from public.poster_boards b
        join private.board_areas a on a.number = b.number
        where b.ward = v_row.ward and a.town = v_row.town
      );
    else
      v_found := exists (
        select 1 from public.poster_boards b
        join private.board_areas a on a.number = b.number
        where b.ward = v_row.ward and a.town = v_row.town and a.chome = v_row.chome
      );
    end if;
    if not v_found then
      raise exception 'unknown_coverage_place';
    end if;
  end loop;

  return v_out;
end;
$$;

-- 読むだけの RPC（operator 以上） --------------------------------------

drop function public.admin_coverage_summary();

-- 区・投票区・校区・町名・丁目ごとの数。番号から投票区が取れない掲示場は district が null の行、
-- 校区・町名の表にない掲示場は校区・町名が null の行にまとめる
create function public.admin_coverage_summary()
returns table (
  unit text,
  ward text,
  district text,
  school text,
  town text,
  chome text,
  total int,
  assigned int,
  reserved int,
  "none" int,
  assignee_labels text[]
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_admin_role('operator');
  return query
  with bc as (
    select b.ward as b_ward, private.board_district(b.number) as b_district,
           a.school as a_school, a.town as a_town, a.chome as a_chome,
           c.board_id, c.coverage, c.assignee_ids
    from private.board_coverage() c
    join public.poster_boards b on b.id = c.board_id
    left join private.board_areas a on a.number = b.number
  ),
  ex as (
    select bc.*, u.aid
    from bc
    left join lateral unnest(bc.assignee_ids) u(aid) on true
  ),
  g as (
    select 1 as ord, 'ward'::text as g_unit, e.b_ward as g_ward, null::text as g_district,
           null::text as g_school, null::text as g_town, null::text as g_chome,
           count(distinct e.board_id)::int as g_total,
           (count(distinct e.board_id) filter (where e.coverage = 'assigned'))::int as g_assigned,
           (count(distinct e.board_id) filter (where e.coverage = 'reserved'))::int as g_reserved,
           (count(distinct e.board_id) filter (where e.coverage = 'none'))::int as g_none,
           array_agg(distinct e.aid) filter (where e.aid is not null) as g_ids
    from ex e group by e.b_ward
    union all
    select 2, 'district', e.b_ward, e.b_district, null, null, null,
           count(distinct e.board_id)::int,
           (count(distinct e.board_id) filter (where e.coverage = 'assigned'))::int,
           (count(distinct e.board_id) filter (where e.coverage = 'reserved'))::int,
           (count(distinct e.board_id) filter (where e.coverage = 'none'))::int,
           array_agg(distinct e.aid) filter (where e.aid is not null)
    from ex e group by e.b_ward, e.b_district
    union all
    select 3, 'school', e.b_ward, null, e.a_school, null, null,
           count(distinct e.board_id)::int,
           (count(distinct e.board_id) filter (where e.coverage = 'assigned'))::int,
           (count(distinct e.board_id) filter (where e.coverage = 'reserved'))::int,
           (count(distinct e.board_id) filter (where e.coverage = 'none'))::int,
           array_agg(distinct e.aid) filter (where e.aid is not null)
    from ex e group by e.b_ward, e.a_school
    union all
    select 4, 'town', e.b_ward, null, null, e.a_town, null,
           count(distinct e.board_id)::int,
           (count(distinct e.board_id) filter (where e.coverage = 'assigned'))::int,
           (count(distinct e.board_id) filter (where e.coverage = 'reserved'))::int,
           (count(distinct e.board_id) filter (where e.coverage = 'none'))::int,
           array_agg(distinct e.aid) filter (where e.aid is not null)
    from ex e group by e.b_ward, e.a_town
    union all
    select 5, 'chome', e.b_ward, null, null, e.a_town, e.a_chome,
           count(distinct e.board_id)::int,
           (count(distinct e.board_id) filter (where e.coverage = 'assigned'))::int,
           (count(distinct e.board_id) filter (where e.coverage = 'reserved'))::int,
           (count(distinct e.board_id) filter (where e.coverage = 'none'))::int,
           array_agg(distinct e.aid) filter (where e.aid is not null)
    from ex e where e.a_chome is not null group by e.b_ward, e.a_town, e.a_chome
  )
  select g.g_unit, g.g_ward, g.g_district, g.g_school, g.g_town, g.g_chome,
         g.g_total, g.g_assigned, g.g_reserved, g.g_none,
         coalesce((
           select array_agg(x.label order by x.label, x.id)
           from private.coverage_assignees x
           where x.id = any (g.g_ids)
         ), '{}'::text[])
  from g
  order by g.ord, g.g_ward, g.g_district, g.g_school, g.g_town,
           length(g.g_chome), g.g_chome;
end;
$$;

drop function public.admin_coverage_boards();

-- 掲示場ごとの判定（地図と一覧用）
create function public.admin_coverage_boards()
returns table (
  board_id uuid,
  number text,
  name text,
  address text,
  ward text,
  lat double precision,
  long double precision,
  status public.poster_board_status,
  district text,
  school text,
  school_source text,
  town text,
  chome text,
  coverage text,
  assignee_labels text[]
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_admin_role('operator');
  return query
  select b.id, b.number, b.name, b.address, b.ward, b.lat, b.long, b.status,
         private.board_district(b.number),
         a.school, a.school_source, a.town, a.chome,
         c.coverage,
         coalesce((
           select array_agg(x.label order by x.label, x.id)
           from private.coverage_assignees x
           where x.id = any (c.assignee_ids)
         ), '{}'::text[])
  from private.board_coverage() c
  join public.poster_boards b on b.id = c.board_id
  left join private.board_areas a on a.number = b.number
  order by b.number;
end;
$$;

-- 担当者の一覧。board_count は範囲のどれかに当たる掲示場の数（重なりは 1 回）
create or replace function public.admin_coverage_assignees()
returns table (
  id uuid,
  label text,
  note text,
  updated_at timestamptz,
  ranges jsonb,
  board_count int
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_admin_role('operator');
  return query
  with counts as (
    select u.aid, count(*)::int as n
    from private.board_coverage() c
    cross join lateral unnest(c.assignee_ids) u(aid)
    group by u.aid
  )
  select x.id, x.label, x.note, x.updated_at,
         coalesce((
           select jsonb_agg(
                    jsonb_build_object(
                      'kind', r.kind, 'ward', r.ward, 'district', r.district,
                      'school', r.school, 'town', r.town, 'chome', r.chome
                    )
                    order by case r.kind
                               when 'ward' then 1 when 'district' then 2 when 'school' then 3
                               when 'town' then 4 else 5
                             end,
                             r.ward, r.district, r.school, r.town, length(r.chome), r.chome
                  )
           from private.coverage_ranges r
           where r.assignee_id = x.id
         ), '[]'::jsonb),
         coalesce(k.n, 0)
  from private.coverage_assignees x
  left join counts k on k.aid = x.id
  order by x.label, x.id;
end;
$$;

-- 担当者の登録・直す（operator 以上） ------------------------------------

create or replace function public.admin_create_coverage_assignee(p_label text, p_note text, p_ranges jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor text;
  v_label text;
  v_note text;
  v_ranges jsonb;
  v_id uuid;
begin
  v_actor := private.require_admin_role('operator');
  v_label := private.clean_coverage_label(p_label);
  v_note := private.clean_coverage_note(p_note);
  v_ranges := private.parse_coverage_ranges(p_ranges);

  insert into private.coverage_assignees (label, note) values (v_label, v_note) returning id into v_id;
  insert into private.coverage_ranges (assignee_id, kind, ward, district, school, town, chome)
  select v_id, x.kind, x.ward, x.district, x.school, x.town, x.chome
  from jsonb_to_recordset(v_ranges)
    as x(kind text, ward text, district text, school text, town text, chome text);
  perform private.write_audit(
    v_actor, 'coverage_assignee_create',
    v_id::text || '（範囲 ' || jsonb_array_length(v_ranges) || '）'
  );
  return v_id;
end;
$$;

create or replace function public.admin_update_coverage_assignee(
  p_id uuid,
  p_expected_updated_at timestamptz,
  p_label text,
  p_note text,
  p_ranges jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor text;
  v_label text;
  v_note text;
  v_ranges jsonb;
  v_updated_at timestamptz;
begin
  v_actor := private.require_admin_role('operator');
  v_label := private.clean_coverage_label(p_label);
  v_note := private.clean_coverage_note(p_note);
  v_ranges := private.parse_coverage_ranges(p_ranges);

  -- 行をロックして、同時に直した人がいれば待つ（待ったあとの updated_at で比べる）
  select a.updated_at into v_updated_at
  from private.coverage_assignees a
  where a.id = p_id
  for update;
  if not found then
    raise exception 'assignee_not_found';
  end if;
  if p_expected_updated_at is distinct from v_updated_at then
    raise exception 'stale_assignee';
  end if;

  update private.coverage_assignees
  set label = v_label, note = v_note, updated_at = now()
  where id = p_id;
  delete from private.coverage_ranges where assignee_id = p_id;
  insert into private.coverage_ranges (assignee_id, kind, ward, district, school, town, chome)
  select p_id, x.kind, x.ward, x.district, x.school, x.town, x.chome
  from jsonb_to_recordset(v_ranges)
    as x(kind text, ward text, district text, school text, town text, chome text);
  perform private.write_audit(
    v_actor, 'coverage_assignee_update',
    p_id::text || '（範囲 ' || jsonb_array_length(v_ranges) || '）'
  );
end;
$$;

-- 権限 ---------------------------------------------------------------

revoke execute on function private.board_district(text) from public, anon, authenticated;

revoke execute on function
  public.admin_coverage_summary(),
  public.admin_coverage_boards()
  from public, anon, authenticated;
grant execute on function
  public.admin_coverage_summary(),
  public.admin_coverage_boards()
  to authenticated;

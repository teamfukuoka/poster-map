-- ローカル開発専用。クラウドには適用しない（supabase db push は seed を流さない）。
insert into private.invite_codes (label, code_hash, code_plain)
values ('local-dev', extensions.crypt('local-dev-code', extensions.gen_salt('bf')), 'local-dev-code');

update private.site_settings
set public_from = now() - interval '1 day',
    public_until = now() + interval '30 days';

insert into public.poster_boards (number, name, address, ward, lat, long, status) values
  ('春吉第一-1', '十八親和銀行ビル駐車場フェンス', '中央区西中洲6番27号', '中央区', 33.5920947, 130.4037078, 'done'),
  ('別府第１-1', '人道橋東側', '城南区別府四丁目７番', '城南区', 33.5730438, 130.3619639, 'not_yet'),
  ('早良-7', '早良小学校正門横フェンス', '早良区早良一丁目8番1号', '早良区', 33.5052703, 130.3373249, 'reserved');

-- 管理画面（ローカルは email とパスワードで入るため、パスワードログインも通す）
update private.admin_settings set allowed_amr = '{oauth,password}';
insert into private.admin_members (email, role) values ('local-admin@example.invalid', 'admin');

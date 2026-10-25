/**
 * 参加コードの入力をそろえる。登録（管理画面）で使う。参加側は normalizeJoinCode。
 * 全角で打たれた英数字・記号を半角にし、前後の空白（全角・タブ・改行も）を落とす。
 */
export function normalizeInviteCode(raw: string): string {
  return raw.normalize("NFKC").trim();
}

// 長音・各種ダッシュ・マイナス記号（NFKC 後に残るもの）
const DASH_LIKE = /[\u30fc\u2010-\u2015\u2212\ufe63]/g;

/**
 * 参加（ボランティアのコード入力）用。normalizeInviteCode のうえで、ダッシュに見える文字を ASCII の「-」に寄せる。
 * 登録されるコードは ASCII だけなので、参加側で寄せても別のコードと取り違えない。
 */
export function normalizeJoinCode(raw: string): string {
  return normalizeInviteCode(raw).replace(DASH_LIKE, "-");
}

/**
 * 参加コードの入力をそろえる。登録（管理画面）と参加（ボランティア）の両方で使う。
 * 全角で打たれた英数字・記号を半角にし、前後の空白（全角・タブ・改行も）を落とす。
 */
export function normalizeInviteCode(raw: string): string {
  return raw.normalize("NFKC").trim();
}

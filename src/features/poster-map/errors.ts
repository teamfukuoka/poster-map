const MESSAGES: Record<string, string> = {
  not_authenticated: "参加の手続きができませんでした。もう一度お試しください。",
  invalid_display_name: "ニックネームは1〜20文字で入力してください。",
  invalid_invite_code: "参加コードが正しくありません。",
  volunteer_revoked: "この端末からの参加は停止されています。運営にお問い合わせください。",
  not_a_volunteer: "報告するには参加の手続きが必要です。",
  note_too_long: "連絡事項は500文字以内で入力してください。",
  board_not_found: "掲示板が見つかりません。地図を更新してください。",
  over_request_rate_limit: "アクセスが集中しています。しばらくしてからもう一度お試しください。",
};

export const FALLBACK_MESSAGE = "エラーが発生しました。時間をおいてもう一度お試しください。";

/** Supabase（PostgREST の RPC 例外・Auth）のエラーを利用者向けの文言にする */
export function toUserMessage(
  error: { code?: string | null; message?: string | null } | null | undefined,
): string {
  if (!error) return FALLBACK_MESSAGE;
  if (error.code && MESSAGES[error.code]) return MESSAGES[error.code];
  if (error.message && MESSAGES[error.message]) return MESSAGES[error.message];
  return FALLBACK_MESSAGE;
}

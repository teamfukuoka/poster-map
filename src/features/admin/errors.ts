import { FALLBACK_MESSAGE } from "@/features/poster-map/errors";

const MESSAGES: Record<string, string> = {
  not_admin: "このアカウントでは管理画面に入れません。管理者に一覧への追加を頼んでください。",
  forbidden: "この操作は管理者だけができます。",
  invalid_invite_code_format:
    "参加コードは8〜64文字で、英字・数字・記号をそれぞれ1つ以上入れてください。空白は使えません。",
  invalid_label: "配布先の名前は1〜50文字で入れてください。",
  duplicate_invite_code: "同じ参加コードがすでに登録されています。別のコードにしてください。",
  invite_code_not_found:
    "参加コードが見つからないか、すでに失効しています。画面を更新してください。",
  reset_closed: "11月1日0:00を過ぎたため、報告をまとめて戻すことはできません。",
  confirm_mismatch: "確認の文字が違います。「リセット」と入れてください。",
};

/** 管理画面の RPC の例外を、画面に出す文言にする */
export function toAdminMessage(
  error: { code?: string | null; message?: string | null } | null | undefined,
): string {
  if (!error) return FALLBACK_MESSAGE;
  // "constructor" などで Object の組み込みのプロパティを返さないよう、自前のキーだけを見る
  if (error.code && Object.hasOwn(MESSAGES, error.code)) return MESSAGES[error.code];
  if (error.message && Object.hasOwn(MESSAGES, error.message)) return MESSAGES[error.message];
  return FALLBACK_MESSAGE;
}

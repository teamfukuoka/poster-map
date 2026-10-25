import { normalizeInviteCode } from "@/features/poster-map/invite-code";

export { normalizeInviteCode };

// DB の admin_register_invite_code と同じ決まり。アプリ側で先に断り、DB でも同じ判定をする
export const INVITE_CODE_MIN_LENGTH = 8;
export const INVITE_CODE_MAX_LENGTH = 64;
export const LABEL_MAX_LENGTH = 50;
export const RESET_CONFIRM_WORD = "リセット";
// DB の admin_publish / admin_revert_acceptance が確かめる文字
export const PUBLISH_CONFIRM_WORD = "公開する";
export const REVERT_CONFIRM_WORD = "受理前に戻す";

const INVITE_CODE_MESSAGE = `参加コードは${INVITE_CODE_MIN_LENGTH}〜${INVITE_CODE_MAX_LENGTH}文字で、英字・数字・記号をそれぞれ1つ以上入れてください。空白は使えません。`;
const LABEL_MESSAGE = `配布先の名前は1〜${LABEL_MAX_LENGTH}文字で入れてください。`;

/** 正規化（normalizeInviteCode）済みの値を調べる。問題があれば文言、なければ null */
export function validateInviteCode(code: string): string | null {
  const ok =
    code.length >= INVITE_CODE_MIN_LENGTH &&
    code.length <= INVITE_CODE_MAX_LENGTH &&
    /^[!-~]+$/.test(code) &&
    /[A-Za-z]/.test(code) &&
    /[0-9]/.test(code) &&
    /[^A-Za-z0-9]/.test(code);
  return ok ? null : INVITE_CODE_MESSAGE;
}

/** 前後の空白を落とした値を調べる。問題があれば文言、なければ null */
export function validateLabel(label: string): string | null {
  // DB の char_length と同じく、サロゲートペアを1文字として数える
  const length = [...label].length;
  return length >= 1 && length <= LABEL_MAX_LENGTH ? null : LABEL_MESSAGE;
}

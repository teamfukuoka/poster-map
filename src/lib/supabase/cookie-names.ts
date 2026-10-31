/**
 * 管理画面のログインは、ボランティアの参加（既定の Cookie）とは別の Cookie に置く。
 * 同じ端末で参加したまま管理画面に入れ、ログイン・ログアウトしても参加は外れない。
 * proxy からも読むので server-only にしない。
 */
export const STAFF_AUTH_COOKIE = "sb-staff-auth-token";

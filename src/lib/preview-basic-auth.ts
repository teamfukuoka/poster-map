import { Buffer } from "node:buffer";
import { createHash, timingSafeEqual } from "node:crypto";

type Env = Record<string, string | undefined>;

export type PreviewAuthResult = "not-preview" | "ok" | "unauthorized" | "misconfigured";

const REALM = "poster-map-preview";

/** 長さの違いも漏らさないよう、ハッシュにそろえてから時間一定で比べる */
function safeEqual(a: string, b: string): boolean {
  const hash = (s: string) => createHash("sha256").update(s, "utf8").digest();
  return timingSafeEqual(hash(a), hash(b));
}

function parseBasic(authorization: string | null): { user: string; password: string } | null {
  const match = authorization?.match(/^basic\s+(\S+)\s*$/i);
  if (!match) return null;
  const decoded = Buffer.from(match[1], "base64").toString("utf8");
  const colon = decoded.indexOf(":");
  if (colon < 0) return null;
  return { user: decoded.slice(0, colon).trim(), password: decoded.slice(colon + 1).trim() };
}

/**
 * 確認用（Vercel の Preview）だけベーシック認証をかける。本番とローカルは素通り。
 * Preview でユーザー名・パスワードの環境変数が空なら、開けたままにせず閉じる。
 */
export function checkPreviewBasicAuth(
  authorization: string | null,
  env: Env = process.env,
): PreviewAuthResult {
  if (env.VERCEL_ENV !== "preview") return "not-preview";
  const user = env.PREVIEW_BASIC_AUTH_USER?.trim();
  const password = env.PREVIEW_BASIC_AUTH_PASSWORD?.trim();
  if (!user || !password) return "misconfigured";
  const given = parseBasic(authorization);
  if (!given) return "unauthorized";
  // 片方が違っても両方比べる（どちらが違うかを時間で漏らさない）
  const userOk = safeEqual(given.user, user);
  const passwordOk = safeEqual(given.password, password);
  return userOk && passwordOk ? "ok" : "unauthorized";
}

/** 通してよければ null。断るときはそのまま返す応答 */
export function previewBasicAuthResponse(
  request: Request,
  env: Env = process.env,
): Response | null {
  const result = checkPreviewBasicAuth(request.headers.get("authorization"), env);
  if (result === "not-preview" || result === "ok") return null;
  if (result === "misconfigured") {
    return new Response("確認用の環境のユーザー名・パスワードが設定されていません。", {
      status: 503,
      headers: { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  return new Response("ユーザー名とパスワードが必要です。", {
    status: 401,
    headers: {
      "WWW-Authenticate": `Basic realm="${REALM}", charset="UTF-8"`,
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}

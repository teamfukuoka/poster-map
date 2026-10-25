const ADMIN_ROOT = "/admin";

/**
 * ログイン後に戻す先。/admin 配下の道だけを通し、外部の URL や `//`・`\` を含む値は /admin に倒す
 * （オープンリダイレクトを防ぐ）。
 */
export function safeAdminPath(next: string | null): string {
  if (next === null) return ADMIN_ROOT;
  const isAdminPath = next === ADMIN_ROOT || next.startsWith(`${ADMIN_ROOT}/`);
  if (!isAdminPath || next.includes("//") || next.includes("\\")) return ADMIN_ROOT;
  return next;
}

/**
 * このサイトの origin。リダイレクト先を Host ヘッダーではなく環境変数で固定するために使う。
 * 未設定・URL でないときは throw する。
 */
export function readAppOrigin(env: Record<string, string | undefined> = process.env): string {
  const raw = env.APP_ORIGIN;
  if (!raw) throw new Error("APP_ORIGIN を設定してください（.env.example 参照）");
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("APP_ORIGIN は http(s) の URL で設定してください（例: http://localhost:3000）");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("APP_ORIGIN は http(s) の URL で設定してください（例: http://localhost:3000）");
  }
  return url.origin;
}

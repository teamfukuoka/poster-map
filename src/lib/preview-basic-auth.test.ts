/** @jest-environment node */
import { checkPreviewBasicAuth, previewBasicAuthResponse } from "./preview-basic-auth";

const preview = {
  VERCEL_ENV: "preview",
  PREVIEW_BASIC_AUTH_USER: "staff",
  PREVIEW_BASIC_AUTH_PASSWORD: "pass-1234!",
};

function basic(userPass: string): string {
  return `Basic ${Buffer.from(userPass, "utf8").toString("base64")}`;
}

describe("checkPreviewBasicAuth", () => {
  test.each([
    { VERCEL_ENV: "production" },
    { VERCEL_ENV: "development" },
    {},
  ])("Preview 以外（%o）では何もしない", (env) => {
    expect(checkPreviewBasicAuth(null, env)).toBe("not-preview");
  });

  test("正しいユーザー名とパスワードなら通す", () => {
    expect(checkPreviewBasicAuth(basic("staff:pass-1234!"), preview)).toBe("ok");
  });

  test("スキーム名の大文字小文字は問わない", () => {
    const header = basic("staff:pass-1234!").replace("Basic", "basic");
    expect(checkPreviewBasicAuth(header, preview)).toBe("ok");
  });

  test("パスワードに : が入っていても通す", () => {
    const env = { ...preview, PREVIEW_BASIC_AUTH_PASSWORD: "a:b:c" };
    expect(checkPreviewBasicAuth(basic("staff:a:b:c"), env)).toBe("ok");
  });

  test("入力と環境変数の前後の空白は取り除いて比べる", () => {
    const env = {
      ...preview,
      PREVIEW_BASIC_AUTH_USER: " staff\n",
      PREVIEW_BASIC_AUTH_PASSWORD: " pass-1234! ",
    };
    expect(checkPreviewBasicAuth(basic(" staff : pass-1234! "), env)).toBe("ok");
  });

  test.each([
    ["ヘッダーなし", null],
    ["パスワード違い", basic("staff:wrong")],
    ["ユーザー名違い", basic("other:pass-1234!")],
    ["パスワードの一部だけ", basic("staff:pass")],
    ["コロンなし", basic("staffpass-1234!")],
    ["空", basic(":")],
    ["Basic 以外", "Bearer abc"],
    ["中身なし", "Basic "],
  ])("%s は断る", (_label, header) => {
    expect(checkPreviewBasicAuth(header, preview)).toBe("unauthorized");
  });

  test.each([
    "PREVIEW_BASIC_AUTH_USER",
    "PREVIEW_BASIC_AUTH_PASSWORD",
  ] as const)("Preview で %s が空なら閉じる", (key) => {
    expect(checkPreviewBasicAuth(basic("staff:pass-1234!"), { ...preview, [key]: "  " })).toBe(
      "misconfigured",
    );
    const { [key]: _omit, ...rest } = preview;
    expect(checkPreviewBasicAuth(basic("staff:pass-1234!"), rest)).toBe("misconfigured");
  });
});

describe("previewBasicAuthResponse", () => {
  function request(authorization?: string): Request {
    return new Request("https://example.invalid/", {
      headers: authorization ? { authorization } : {},
    });
  }

  test("Preview 以外と認証済みは null（そのまま先へ進む）", () => {
    expect(previewBasicAuthResponse(request(), { VERCEL_ENV: "production" })).toBeNull();
    expect(previewBasicAuthResponse(request(basic("staff:pass-1234!")), preview)).toBeNull();
  });

  test("認証がなければ 401 とユーザー名・パスワードの入力を求めるヘッダーを返す", async () => {
    const response = previewBasicAuthResponse(request(), preview);
    expect(response?.status).toBe(401);
    expect(response?.headers.get("WWW-Authenticate")).toBe(
      'Basic realm="poster-map-preview", charset="UTF-8"',
    );
    expect(response?.headers.get("Cache-Control")).toBe("no-store");
    expect(await response?.text()).not.toContain("pass-1234!");
  });

  test("未設定なら 503 で閉じ、入力欄は出さない", () => {
    const response = previewBasicAuthResponse(request(), { VERCEL_ENV: "preview" });
    expect(response?.status).toBe(503);
    expect(response?.headers.get("WWW-Authenticate")).toBeNull();
    expect(response?.headers.get("Cache-Control")).toBe("no-store");
  });
});

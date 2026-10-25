import { unstable_cache } from "next/cache";
import { getSiteName, SITE_NAME_FALLBACK, SITE_NAME_TAG } from "./site-name";

const mockRpc = jest.fn();

jest.mock("server-only", () => ({}));
jest.mock("next/cache", () => ({
  unstable_cache: jest.fn((fn: unknown) => fn),
}));
jest.mock("@/lib/supabase/public", () => ({
  createPublicClient: () => ({ rpc: mockRpc }),
}));

let errorSpy: jest.SpyInstance;
beforeEach(() => {
  mockRpc.mockReset();
  errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => errorSpy.mockRestore());

test("フォールバックは受理前の名前", () => {
  expect(SITE_NAME_FALLBACK).toBe("福岡市ポスター掲示板マップ");
});

test("キャッシュは30秒以内・tag は site-name", () => {
  // unstable_cache は import 時に一度だけ作られる
  const [, keyParts, options] = jest.mocked(unstable_cache).mock.calls[0];
  expect(keyParts).toEqual(["site-name"]);
  expect(options).toEqual({ revalidate: 30, tags: ["site-name"] });
  expect(SITE_NAME_TAG).toBe("site-name");
});

test("DB の current_site_name の値をそのまま返す", async () => {
  mockRpc.mockResolvedValue({ data: "佐々木あやの ポスター掲示板マップ", error: null });
  await expect(getSiteName()).resolves.toBe("佐々木あやの ポスター掲示板マップ");
  expect(mockRpc).toHaveBeenCalledWith("current_site_name");
  expect(errorSpy).not.toHaveBeenCalled();
});

test("DB のエラーはフォールバックにして、code だけを出す", async () => {
  mockRpc.mockResolvedValue({
    data: null,
    error: { code: "PGRST301", message: "secret detail at https://x.invalid" },
  });
  await expect(getSiteName()).resolves.toBe(SITE_NAME_FALLBACK);
  expect(errorSpy).toHaveBeenCalledTimes(1);
  const logged = JSON.stringify(errorSpy.mock.calls[0]);
  expect(logged).toContain("PGRST301");
  expect(logged).not.toContain("secret");
  expect(logged).not.toContain("x.invalid");
});

test.each([[null], [""], ["   "], [123]])("空の値（%p）はフォールバック", async (data) => {
  mockRpc.mockResolvedValue({ data, error: null });
  await expect(getSiteName()).resolves.toBe(SITE_NAME_FALLBACK);
  expect(JSON.stringify(errorSpy.mock.calls[0])).toContain("empty");
});

test("例外（接続できないなど）もフォールバックにして、メッセージは出さない", async () => {
  mockRpc.mockRejectedValue(new Error("connect ECONNREFUSED 10.0.0.1"));
  await expect(getSiteName()).resolves.toBe(SITE_NAME_FALLBACK);
  expect(JSON.stringify(errorSpy.mock.calls[0])).not.toContain("10.0.0.1");
});

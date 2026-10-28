import { unstable_cache } from "next/cache";
import { getIsPublicWindow, PUBLIC_WINDOW_TAG } from "./public-window";

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

test("キャッシュは30秒以内・tag は public-window", () => {
  // unstable_cache は import 時に一度だけ作られる
  const [, keyParts, options] = jest.mocked(unstable_cache).mock.calls[0];
  expect(keyParts).toEqual(["public-window"]);
  expect(options).toEqual({ revalidate: 30, tags: ["public-window"] });
  expect(PUBLIC_WINDOW_TAG).toBe("public-window");
});

test.each([[true], [false]])("DB の is_public_window の値（%p）をそのまま返す", async (data) => {
  mockRpc.mockResolvedValue({ data, error: null });
  await expect(getIsPublicWindow()).resolves.toBe(data);
  expect(mockRpc).toHaveBeenCalledWith("is_public_window");
  expect(errorSpy).not.toHaveBeenCalled();
});

test("DB のエラーは null にして、code だけを出す", async () => {
  mockRpc.mockResolvedValue({
    data: null,
    error: { code: "PGRST301", message: "secret detail at https://x.invalid" },
  });
  await expect(getIsPublicWindow()).resolves.toBeNull();
  const logged = JSON.stringify(errorSpy.mock.calls[0]);
  expect(logged).toContain("PGRST301");
  expect(logged).not.toContain("secret");
  expect(logged).not.toContain("x.invalid");
});

test.each([[null], ["true"], [1]])("真偽値でない値（%p）は null", async (data) => {
  mockRpc.mockResolvedValue({ data, error: null });
  await expect(getIsPublicWindow()).resolves.toBeNull();
  expect(JSON.stringify(errorSpy.mock.calls[0])).toContain("not_boolean");
});

test("例外（接続できないなど）も null にして、メッセージは出さない", async () => {
  mockRpc.mockRejectedValue(new Error("connect ECONNREFUSED 10.0.0.1"));
  await expect(getIsPublicWindow()).resolves.toBeNull();
  expect(JSON.stringify(errorSpy.mock.calls[0])).not.toContain("10.0.0.1");
});

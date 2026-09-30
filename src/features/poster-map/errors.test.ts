import { FALLBACK_MESSAGE, toUserMessage } from "./errors";

test("RPC の例外（message）を日本語にする", () => {
  expect(toUserMessage({ code: "P0001", message: "invalid_invite_code" })).toBe(
    "参加コードが正しくありません。",
  );
});

test("Auth のエラー（code）を日本語にする", () => {
  expect(
    toUserMessage({ code: "over_request_rate_limit", message: "Request rate limit reached" }),
  ).toBe("アクセスが集中しています。しばらくしてからもう一度お試しください。");
});

test("知らないエラー・null は共通の文言", () => {
  expect(toUserMessage({ message: "connection refused" })).toBe(FALLBACK_MESSAGE);
  expect(toUserMessage(null)).toBe(FALLBACK_MESSAGE);
});

test("Object の組み込みのプロパティ名は共通の文言", () => {
  expect(toUserMessage({ code: "constructor" })).toBe(FALLBACK_MESSAGE);
  expect(toUserMessage({ message: "toString" })).toBe(FALLBACK_MESSAGE);
  expect(toUserMessage({ message: "__proto__" })).toBe(FALLBACK_MESSAGE);
});

test("参加コードの試行回数の上限", () => {
  expect(toUserMessage({ code: "P0001", message: "too_many_attempts" })).toBe(
    "参加コードの入力に続けて失敗したため、受付を一時停止しています。15分ほどたってから、もう一度お試しください。",
  );
});

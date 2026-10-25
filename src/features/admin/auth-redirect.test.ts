import { readAppOrigin, safeAdminPath } from "./auth-redirect";

describe("safeAdminPath", () => {
  it("/admin 配下の道はそのまま返す", () => {
    expect(safeAdminPath("/admin/codes")).toBe("/admin/codes");
    expect(safeAdminPath("/admin")).toBe("/admin");
    expect(safeAdminPath("/admin/")).toBe("/admin/");
  });

  it.each([
    ["null", null],
    ["ルート", "/"],
    ["外部の URL", "https://evil.example/admin"],
    ["スキームなしの外部", "//evil.example/admin"],
    ["/admin 配下に見せたバックスラッシュ", "/admin\\..\\"],
    ["/admin で始まる別の道", "/administrator"],
    ["/admin 配下の二重スラッシュ", "/admin//evil.example"],
    ["ドットセグメント", "/admin/../"],
    ["エンコードしたドット（小文字）", "/admin/%2e%2e/x"],
    ["エンコードしたドット（大文字）", "/admin/%2E%2E/x"],
    ["タブ", "/admin/\t/evil.com"],
    ["改行", "/admin/\n"],
  ])("%s は /admin に倒す", (_name, next) => {
    expect(safeAdminPath(next)).toBe("/admin");
  });
});

describe("readAppOrigin", () => {
  it("origin だけを返す", () => {
    expect(readAppOrigin({ APP_ORIGIN: "http://localhost:3000/" })).toBe("http://localhost:3000");
  });

  it("未設定なら throw する", () => {
    expect(() => readAppOrigin({})).toThrow();
  });

  it("スキームが http(s) でなければ throw する", () => {
    expect(() => readAppOrigin({ APP_ORIGIN: "localhost:3000" })).toThrow();
    expect(() => readAppOrigin({ APP_ORIGIN: "javascript:alert(1)" })).toThrow();
  });

  it("URL でなければ throw する", () => {
    expect(() => readAppOrigin({ APP_ORIGIN: "localhost" })).toThrow();
  });
});

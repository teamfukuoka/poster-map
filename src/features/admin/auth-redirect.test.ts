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

  it("URL でなければ throw する", () => {
    expect(() => readAppOrigin({ APP_ORIGIN: "localhost" })).toThrow();
  });
});

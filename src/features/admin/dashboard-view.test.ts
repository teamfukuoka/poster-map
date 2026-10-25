import {
  formatJst,
  isBeforeStaleTable,
  siteStateLabel,
  sortWardProgress,
  textOrDash,
} from "./dashboard-view";
import type { SiteState, WardProgress } from "./types";

const ward = (name: string): WardProgress => ({ ward: name, total: 10, done: 1, reserved: 2 });

test("sortWardProgress は逆順で渡した7区を公式の順に並べる", () => {
  const reversed = ["西区", "早良区", "城南区", "南区", "中央区", "博多区", "東区"].map(ward);
  expect(sortWardProgress(reversed).map((r) => r.ward)).toEqual([
    "東区",
    "博多区",
    "中央区",
    "南区",
    "城南区",
    "早良区",
    "西区",
  ]);
});

test("sortWardProgress は知らない区を末尾に、渡された順のまま置く", () => {
  const rows = ["不明B区", "西区", "不明A区", "東区"].map(ward);
  expect(sortWardProgress(rows).map((r) => r.ward)).toEqual(["東区", "西区", "不明B区", "不明A区"]);
});

test("sortWardProgress は渡した配列を書き換えない", () => {
  const rows = ["西区", "東区"].map(ward);
  sortWardProgress(rows);
  expect(rows.map((r) => r.ward)).toEqual(["西区", "東区"]);
});

const site = (over: Partial<SiteState>): SiteState => ({
  force_hidden: false,
  is_public: true,
  public_from: "2026-10-01T00:00:00+09:00",
  public_until: "2026-12-01T00:00:00+09:00",
  rehearsal_reset_until: "2026-11-01T00:00:00+09:00",
  ...over,
});

test("siteStateLabel: 止めていなくて公開の期間内なら公開中", () => {
  expect(siteStateLabel(site({}))).toBe("公開中");
});

test("siteStateLabel: force_hidden なら期間の内でも外でも止めている", () => {
  expect(siteStateLabel(site({ force_hidden: true, is_public: false }))).toBe("止めている");
  expect(
    siteStateLabel(
      site({ force_hidden: true, is_public: false, public_until: "2026-10-01T00:00:00+09:00" }),
    ),
  ).toBe("止めている");
});

test("siteStateLabel: 止めていなくて期間外なら期間外", () => {
  expect(
    siteStateLabel(site({ is_public: false, public_until: "2026-10-01T00:00:00+09:00" })),
  ).toBe("期間外");
});

test("isBeforeStaleTable は 11/1 14:00 (JST) を境にする", () => {
  expect(isBeforeStaleTable(new Date("2026-11-01T13:59:59+09:00"))).toBe(true);
  expect(isBeforeStaleTable(new Date("2026-11-01T14:00:00+09:00"))).toBe(false);
});

test("formatJst は日本時間で出し、null・空・不正な値は「—」", () => {
  expect(formatJst("2026-11-01T05:00:00Z")).toBe("2026/11/1 14:00:00");
  expect(formatJst(null)).toBe("—");
  expect(formatJst("")).toBe("—");
  expect(formatJst("not a date")).toBe("—");
});

test("textOrDash は null・空白だけを「—」にし、HTML はそのまま文字として返す", () => {
  expect(textOrDash(null)).toBe("—");
  expect(textOrDash("  ")).toBe("—");
  expect(textOrDash("<b>危険</b>")).toBe("<b>危険</b>");
});

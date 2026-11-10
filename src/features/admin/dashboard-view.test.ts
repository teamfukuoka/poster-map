import {
  formatJst,
  isBeforeStaleTable,
  showStickerTables,
  siteStateLabel,
  sortWardProgress,
  sumStickerProgress,
  sumWardProgress,
  textOrDash,
} from "./dashboard-view";
import type { SiteState, WardProgress } from "./types";

const ward = (name: string): WardProgress => ({ ward: name, total: 10, planned: 2, done: 1 });

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

test("sumWardProgress は全数・計画・実績をそれぞれ足す", () => {
  const rows: WardProgress[] = [
    { ward: "東区", total: 10, planned: 4, done: 1 },
    { ward: "南区", total: 5, planned: 5, done: 2 },
  ];
  expect(sumWardProgress(rows)).toEqual({ total: 15, planned: 9, done: 3 });
});

test("sumWardProgress は空なら全部 0", () => {
  expect(sumWardProgress([])).toEqual({ total: 0, planned: 0, done: 0 });
});

const site = (over: Partial<SiteState>): SiteState => ({
  force_hidden: false,
  is_public: true,
  public_from: "2026-10-01T00:00:00+09:00",
  public_until: "2026-12-01T00:00:00+09:00",
  rehearsal_reset_until: "2026-11-01T00:00:00+09:00",
  accepted_at: null,
  site_name: "福岡市ポスター掲示板マップ",
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

describe("シールの表", () => {
  const row = (reserved: number, done: number, issue: number) => ({
    ward: "東区",
    target: 5,
    reserved,
    done,
    issue,
  });

  test("sumStickerProgress は区を足し合わせる", () => {
    expect(sumStickerProgress([row(1, 2, 0), row(0, 1, 3)])).toEqual({
      target: 10,
      reserved: 1,
      done: 3,
      issue: 3,
    });
    expect(sumStickerProgress([])).toEqual({ target: 0, reserved: 0, done: 0, issue: 0 });
  });

  test("showStickerTables は、始めているか、報告が残っているときだけ true", () => {
    expect(showStickerTables({ enabled: true, progress: [], issues: [] })).toBe(true);
    expect(showStickerTables({ enabled: false, progress: [row(0, 0, 0)], issues: [] })).toBe(false);
    expect(showStickerTables({ enabled: false, progress: [row(0, 1, 0)], issues: [] })).toBe(true);
    expect(showStickerTables({ enabled: false, progress: [row(1, 0, 0)], issues: [] })).toBe(true);
  });
});

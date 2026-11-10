import { render, screen, within } from "@testing-library/react";
import { REHEARSAL_NOTE } from "../coverage-view";
import type { Dashboard as DashboardData } from "../types";
import { Dashboard } from "./dashboard";

const BEFORE = new Date("2026-10-31T12:00:00+09:00");
const AFTER = new Date("2026-11-01T00:00:00+09:00");

const data: DashboardData = {
  site: {
    public_from: "2026-10-31T15:00:00Z",
    public_until: "2026-11-15T15:00:00Z",
    force_hidden: false,
    is_public: true,
    rehearsal_reset_until: "2026-10-31T15:00:00Z",
    accepted_at: null,
    site_name: "福岡市ポスター掲示板マップ",
  },
  stale: [],
  dangerous: [],
  reports: [],
  wards: [
    { ward: "南区", total: 5, planned: 5, done: 2 },
    { ward: "東区", total: 10, planned: 4, done: 1 },
  ],
  sticker: { enabled: false, progress: [], issues: [] },
};

function wardTable() {
  return screen
    .getByRole("heading", { name: "区ごとの進み具合" })
    .closest("section") as HTMLElement;
}

test("区ごとの進み具合の列は 区・全数・計画・実績", () => {
  render(<Dashboard data={data} now={AFTER} />);
  const headers = within(wardTable())
    .getAllByRole("columnheader")
    .map((h) => h.textContent);
  expect(headers).toEqual(["区", "全数", "計画", "実績"]);
});

test("計画と実績は数（割合）で、区の順に並び、最後に合計の行がある", () => {
  render(<Dashboard data={data} now={AFTER} />);
  const rows = within(wardTable())
    .getAllByRole("row")
    .slice(1)
    .map((r) =>
      within(r)
        .getAllByRole("cell")
        .map((c) => c.textContent),
    );
  expect(rows).toEqual([
    ["東区", "10", "4（40%）", "1（10%）"],
    ["南区", "5", "5（100%）", "2（40%）"],
    ["合計", "15", "9（60%）", "3（20%）"],
  ]);
});

test("10/31 まではリハーサルの一行を出し、11/1 からは出さない", () => {
  const { rerender } = render(<Dashboard data={data} now={BEFORE} />);
  expect(screen.getByText(REHEARSAL_NOTE)).toBeInTheDocument();
  rerender(<Dashboard data={data} now={AFTER} />);
  expect(screen.queryByText(/リハーサルの報告です/)).not.toBeInTheDocument();
});

test("区が 0 件なら表の代わりに「いまはありません」を出す", () => {
  render(<Dashboard data={{ ...data, wards: [] }} now={AFTER} />);
  const section = wardTable();
  expect(within(section).getByText("いまはありません")).toBeInTheDocument();
  expect(within(section).queryByRole("table")).not.toBeInTheDocument();
});

test("全数が 0 の区は「0（—）」になる", () => {
  render(
    <Dashboard
      data={{ ...data, wards: [{ ward: "東区", total: 0, planned: 0, done: 0 }] }}
      now={AFTER}
    />,
  );
  const cells = within(wardTable())
    .getAllByRole("row")
    .slice(1)
    .map((r) =>
      within(r)
        .getAllByRole("cell")
        .map((c) => c.textContent),
    );
  expect(cells).toEqual([
    ["東区", "0", "0（—）", "0（—）"],
    ["合計", "0", "0（—）", "0（—）"],
  ]);
});

const stickerOn: DashboardData = {
  ...data,
  sticker: {
    enabled: true,
    progress: [
      { ward: "南区", target: 4, reserved: 1, done: 2, issue: 1 },
      { ward: "東区", target: 6, reserved: 0, done: 3, issue: 0 },
    ],
    issues: [
      {
        board_id: "b1",
        number: "12-3",
        ward: "南区",
        name: "大橋",
        poster_status: "done",
        reported_at: "2026-11-12T01:00:00Z",
        reported_by: "あやの",
        note: "ポスターが破れている",
      },
    ],
  },
};

function sectionOf(name: string) {
  return screen.getByRole("heading", { name }).closest("section") as HTMLElement;
}

test("シールを始めておらず報告もなければ、シールの表は出さない", () => {
  render(
    <Dashboard
      data={{
        ...data,
        sticker: {
          enabled: false,
          progress: [{ ward: "東区", target: 3, reserved: 0, done: 0, issue: 0 }],
          issues: [],
        },
      }}
      now={AFTER}
    />,
  );
  expect(screen.queryByRole("heading", { name: "シールの「問題あり」" })).not.toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "区ごとのシールの状況" })).not.toBeInTheDocument();
});

test("止めたあとでも、報告が残っていればシールの表を出す", () => {
  render(
    <Dashboard
      data={{ ...stickerOn, sticker: { ...stickerOn.sticker, enabled: false } }}
      now={AFTER}
    />,
  );
  expect(screen.getByRole("heading", { name: "区ごとのシールの状況" })).toBeInTheDocument();
});

test("シールの「問題あり」に、ポスターの状況と連絡事項を出す", () => {
  render(<Dashboard data={stickerOn} now={AFTER} />);
  const section = sectionOf("シールの「問題あり」");
  const headers = within(section)
    .getAllByRole("columnheader")
    .map((h) => h.textContent);
  expect(headers).toEqual([
    "番号",
    "区",
    "名前",
    "ポスターの状況",
    "報告の時刻",
    "報告した人",
    "連絡事項",
  ]);
  const cells = within(within(section).getAllByRole("row")[1])
    .getAllByRole("cell")
    .map((c) => c.textContent);
  expect(cells[0]).toBe("12-3");
  expect(cells[3]).toBe("完了");
  expect(cells[6]).toBe("ポスターが破れている");
});

test("始めていて「問題あり」がなければ「いまはありません」", () => {
  render(
    <Dashboard
      data={{ ...stickerOn, sticker: { ...stickerOn.sticker, issues: [] } }}
      now={AFTER}
    />,
  );
  expect(
    within(sectionOf("シールの「問題あり」")).getByText("いまはありません"),
  ).toBeInTheDocument();
});

test("区ごとのシールの状況は、区の順に並び、完了は対象に対する割合で、最後に合計", () => {
  render(<Dashboard data={stickerOn} now={AFTER} />);
  const rows = within(sectionOf("区ごとのシールの状況"))
    .getAllByRole("row")
    .map((r) =>
      within(r)
        .queryAllByRole("cell")
        .map((c) => c.textContent),
    )
    .slice(1);
  expect(rows).toEqual([
    ["東区", "6", "0", "3（50%）", "0"],
    ["南区", "4", "1", "2（50%）", "1"],
    ["合計", "10", "1", "5（50%）", "1"],
  ]);
});

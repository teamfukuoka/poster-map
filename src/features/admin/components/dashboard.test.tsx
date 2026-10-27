import { render, screen, within } from "@testing-library/react";
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
  expect(screen.getByText("10/31 までの予約・貼ったはリハーサルの報告です")).toBeInTheDocument();
  rerender(<Dashboard data={data} now={AFTER} />);
  expect(screen.queryByText(/リハーサルの報告です/)).not.toBeInTheDocument();
});

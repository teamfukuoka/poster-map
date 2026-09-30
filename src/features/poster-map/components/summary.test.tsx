import { render, screen, within } from "@testing-library/react";
import type { BoardStatus } from "../status";
import { SummaryBar } from "./summary-bar";
import { WardSummary } from "./ward-summary";

const boards = [
  { ward: "中央区", status: "done" as BoardStatus },
  { ward: "中央区", status: "not_yet" as BoardStatus },
  { ward: "東区", status: "done" as BoardStatus },
  { ward: "東区", status: "error_wrong_poster" as BoardStatus },
];

test("SummaryBar は総数・完了・完了率・内訳を出す", () => {
  render(<SummaryBar boards={boards} />);
  expect(screen.getByTestId("summary-total")).toHaveTextContent("4");
  expect(screen.getByTestId("summary-done")).toHaveTextContent("2");
  expect(screen.getByTestId("summary-percent")).toHaveTextContent("50%");
  expect(screen.getByText("他候補")).toHaveTextContent("他候補1");
});

test("WardSummary は区の並び順（東区が先）で行を出す", () => {
  render(<WardSummary boards={boards} />);
  const rows = screen.getAllByRole("row").slice(1);
  expect(rows.map((r) => within(r).getAllByRole("cell")[0].textContent)).toEqual([
    "東区",
    "中央区",
  ]);
  expect(
    within(rows[1])
      .getAllByRole("cell")
      .map((c) => c.textContent),
  ).toEqual(["中央区", "2", "1", "50%"]);
});

import { render, screen, within } from "@testing-library/react";
import { REHEARSAL_NOTE } from "../coverage-view";
import { board, SUMMARY } from "./coverage-fixtures";
import { CoverageTotals } from "./coverage-totals";

const BEFORE = new Date("2026-10-31T12:00:00+09:00");
const AFTER = new Date("2026-11-01T00:00:00+09:00");

function tile(name: string) {
  return screen.getByText(name).closest("div") as HTMLElement;
}

test("掲示場・担当あり・予約あり・担当なし・カバー率を出す", () => {
  render(<CoverageTotals summary={SUMMARY} boards={[]} now={AFTER} />);
  expect(within(tile("掲示場")).getByText("15")).toBeInTheDocument();
  expect(within(tile("担当あり")).getByText("9")).toBeInTheDocument();
  expect(within(tile("予約あり")).getByText("2")).toBeInTheDocument();
  expect(within(tile("担当なし")).getByText("4")).toBeInTheDocument();
  // (9 + 2) / 15 = 73%
  expect(within(tile("カバー率")).getByText("11（73%）")).toBeInTheDocument();
});

test("担当なしの数は赤い文字", () => {
  render(<CoverageTotals summary={SUMMARY} boards={[]} now={AFTER} />);
  expect(within(tile("担当なし")).getByText("4")).toHaveClass("text-destructive");
});

test("10/31 まではリハーサルの注記を出し、11/1 からは出さない", () => {
  const { rerender } = render(<CoverageTotals summary={SUMMARY} boards={[]} now={BEFORE} />);
  expect(screen.getByText(REHEARSAL_NOTE)).toBeInTheDocument();
  rerender(<CoverageTotals summary={SUMMARY} boards={[]} now={AFTER} />);
  expect(screen.queryByText(/リハーサルの報告です/)).not.toBeInTheDocument();
});

test("校区・町名が入っていない掲示場があれば、取り込みのやり直しを促す", () => {
  const boards = [
    board({ board_id: "x1", school_source: null }),
    board({ board_id: "x2", school_source: null }),
    board({ board_id: "x3", school_source: null }),
    board({ board_id: "x4" }),
  ];
  render(<CoverageTotals summary={SUMMARY} boards={boards} now={AFTER} />);
  expect(screen.getByRole("alert")).toHaveTextContent(
    "校区・町名が入っていない掲示場が 3 か所あります。掲示場の取り込みをやり直してください。",
  );
});

test("全部入っていれば促さない", () => {
  render(<CoverageTotals summary={SUMMARY} boards={[board({ board_id: "x4" })]} now={AFTER} />);
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

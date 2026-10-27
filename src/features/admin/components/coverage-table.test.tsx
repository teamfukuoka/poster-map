import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import type { CoverageSummaryRow } from "../types";
import { BOARDS, SUMMARY } from "./coverage-fixtures";
import { CoverageTable } from "./coverage-table";

function Harness() {
  const [selected, setSelected] = useState<CoverageSummaryRow | null>(null);
  return (
    <CoverageTable summary={SUMMARY} boards={BOARDS} selected={selected} onSelect={setSelected} />
  );
}

function rowOf(text: string) {
  return within(screen.getByRole("table")).getByText(text).closest("tr") as HTMLElement;
}

test("はじめは区の単位で、担当なしの多い順に並ぶ", () => {
  render(<Harness />);
  const names = screen
    .getAllByRole("row")
    .slice(1)
    .map((r) => within(r).getAllByRole("cell")[0].textContent);
  expect(names[0]).toContain("東区");
  expect(names[1]).toContain("南区");
});

test("列は 掲示場・担当あり・予約あり・担当なし・カバー率・いまの担当者", () => {
  render(<Harness />);
  const heads = screen.getAllByRole("columnheader").map((h) => h.textContent);
  expect(heads).toEqual([
    "地名",
    "掲示場",
    "担当あり",
    "予約あり",
    "担当なし",
    "カバー率",
    "いまの担当者",
  ]);
  const cells = within(rowOf("東区"))
    .getAllByRole("cell")
    .map((c) => c.textContent);
  expect(cells.slice(1, 6)).toEqual(["10", "4", "2", "4", "6（60%）"]);
});

test("単位を切り替えると行が変わる", () => {
  render(<Harness />);
  fireEvent.click(screen.getByRole("button", { name: "校区" }));
  expect(screen.getByText("宮竹小")).toBeInTheDocument();
  expect(screen.getByText("馬出小")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "町名" }));
  expect(screen.getByText("箱崎")).toBeInTheDocument();
  expect(screen.queryByText("宮竹小")).not.toBeInTheDocument();
});

test("校区が null の行は「校区なし」と出る", () => {
  render(<Harness />);
  fireEvent.click(screen.getByRole("button", { name: "校区" }));
  expect(screen.getByText("校区なし")).toBeInTheDocument();
});

test("区で絞れる", () => {
  render(<Harness />);
  fireEvent.click(screen.getByRole("button", { name: "町名" }));
  fireEvent.change(screen.getByLabelText("区で絞る"), { target: { value: "南区" } });
  expect(screen.getByText("桧原")).toBeInTheDocument();
  expect(screen.queryByText("箱崎")).not.toBeInTheDocument();
});

test("「担当なしがある所だけ」で none が 0 の行が消える", () => {
  render(<Harness />);
  fireEvent.click(screen.getByRole("button", { name: "町名" }));
  expect(screen.getByText("桧原")).toBeInTheDocument();
  fireEvent.click(screen.getByLabelText("担当なしがある所だけ"));
  expect(screen.queryByText("桧原")).not.toBeInTheDocument();
  expect(screen.getByText("箱崎")).toBeInTheDocument();
});

test("担当者は 3 人まで出し、残りは「ほか N 人」", () => {
  render(<Harness />);
  fireEvent.click(screen.getByRole("button", { name: "町名" }));
  const cells = within(rowOf("馬出")).getAllByRole("cell");
  expect(cells[6]).toHaveTextContent("A班、B班、C班 ほか2人");
  expect(cells[6]).not.toHaveTextContent("D班");
});

test("町名の行を開くと丁目の行が出る", () => {
  render(<Harness />);
  fireEvent.click(screen.getByRole("button", { name: "町名" }));
  expect(screen.queryByText("1丁目")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "馬出の丁目を見る（2）" }));
  expect(screen.getByText("1丁目")).toBeInTheDocument();
  expect(screen.getByText("2丁目")).toBeInTheDocument();
  // 丁目の行のない町名には開くボタンがない
  expect(screen.queryByRole("button", { name: /箱崎の丁目/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "馬出の丁目を閉じる" }));
  expect(screen.queryByText("1丁目")).not.toBeInTheDocument();
});

test("行を押すと、その範囲の掲示場が出る", () => {
  render(<Harness />);
  fireEvent.click(screen.getByRole("button", { name: "町名" }));
  fireEvent.click(screen.getByRole("button", { name: "馬出" }));
  const list = screen.getByRole("region", { name: "馬出の掲示場" });
  expect(within(list).getByText("東-001")).toBeInTheDocument();
  expect(within(list).getByText("福岡市東区馬出2-2")).toBeInTheDocument();
  expect(within(list).queryByText("東-003")).not.toBeInTheDocument();
  expect(within(list).getByText("担当あり")).toBeInTheDocument();
  expect(within(list).getByText("担当なし")).toBeInTheDocument();
  // b2 は貼った（done）、b1 は未貼付
  expect(within(list).getByText("貼った")).toBeInTheDocument();
  expect(within(list).getByText("まだ")).toBeInTheDocument();
});

test("予約ありの掲示場は「予約あり」と出る", () => {
  render(<Harness />);
  fireEvent.click(screen.getByRole("button", { name: "町名" }));
  fireEvent.click(screen.getByRole("button", { name: "箱崎" }));
  const list = screen.getByRole("region", { name: "箱崎の掲示場" });
  expect(within(list).getByText("予約あり")).toBeInTheDocument();
});

test("単位を切り替えると選びが外れる", () => {
  render(<Harness />);
  fireEvent.click(screen.getByRole("button", { name: "東区" }));
  expect(screen.getByRole("region", { name: "東区の掲示場" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "校区" }));
  expect(screen.queryByRole("region", { name: /の掲示場/ })).not.toBeInTheDocument();
});

test("絞り込みで選んだ行が一覧から消えたら、掲示場の一覧も閉じる", () => {
  render(<Harness />);
  fireEvent.click(screen.getByRole("button", { name: "町名" }));
  fireEvent.click(screen.getByRole("button", { name: "桧原" }));
  expect(screen.getByRole("region", { name: "桧原の掲示場" })).toBeInTheDocument();
  fireEvent.click(screen.getByLabelText("担当なしがある所だけ"));
  expect(screen.queryByRole("region", { name: /の掲示場/ })).not.toBeInTheDocument();
});

test("区の絞り込みで消えた行の選びも外れ、残る行の選びは残る", () => {
  render(<Harness />);
  fireEvent.click(screen.getByRole("button", { name: "町名" }));
  fireEvent.click(screen.getByRole("button", { name: "馬出" }));
  fireEvent.change(screen.getByLabelText("区で絞る"), { target: { value: "東区" } });
  expect(screen.getByRole("region", { name: "馬出の掲示場" })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("区で絞る"), { target: { value: "南区" } });
  expect(screen.queryByRole("region", { name: /の掲示場/ })).not.toBeInTheDocument();
});

test("丁目の行を選んだまま町名の行を閉じると、選びが外れる", () => {
  render(<Harness />);
  fireEvent.click(screen.getByRole("button", { name: "町名" }));
  fireEvent.click(screen.getByRole("button", { name: "馬出の丁目を見る（2）" }));
  fireEvent.click(screen.getByRole("button", { name: "2丁目" }));
  expect(screen.getByRole("region", { name: "2丁目の掲示場" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "馬出の丁目を閉じる" }));
  expect(screen.queryByRole("region", { name: /の掲示場/ })).not.toBeInTheDocument();
});

test("地名のセルは折り返さない", () => {
  render(<Harness />);
  expect(within(rowOf("東区")).getAllByRole("cell")[0]).toHaveClass("whitespace-nowrap");
});

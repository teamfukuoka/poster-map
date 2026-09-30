import { act, renderHook } from "@testing-library/react";
import { BOARD_STATUSES, type BoardStatus } from "./status";
import { useBoardFilter } from "./use-board-filter";

const boards = [
  { id: "1", status: "done" as BoardStatus },
  { id: "2", status: "not_yet" as BoardStatus },
];
const mine = new Set(["2"]);

test("最初は全ステータスを表示する", () => {
  const { result } = renderHook(() => useBoardFilter(boards, mine));
  expect(result.current.filterState.statuses.size).toBe(BOARD_STATUSES.length);
  expect(result.current.filteredBoards).toHaveLength(2);
});

test("ステータスを切り替えられる", () => {
  const { result } = renderHook(() => useBoardFilter(boards, mine));
  act(() => result.current.toggleStatus("done"));
  expect(result.current.filteredBoards.map((b) => b.id)).toEqual(["2"]);
  act(() => result.current.toggleStatus("done"));
  expect(result.current.filteredBoards).toHaveLength(2);
});

test("全て解除・全て選択は「自分のもの」の設定を保つ", () => {
  const { result } = renderHook(() => useBoardFilter(boards, mine));
  act(() => result.current.toggleShowOnlyMine());
  act(() => result.current.deselectAll());
  expect(result.current.filteredBoards).toEqual([]);
  act(() => result.current.selectAll());
  expect(result.current.filterState.showOnlyMine).toBe(true);
  expect(result.current.filteredBoards.map((b) => b.id)).toEqual(["2"]);
});

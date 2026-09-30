import { filterBoards } from "./filter";
import type { BoardStatus } from "./status";

const boards = [
  { id: "1", status: "done" as BoardStatus },
  { id: "2", status: "not_yet" as BoardStatus },
  { id: "3", status: "done" as BoardStatus },
];

test("選んだステータスだけを残す", () => {
  expect(
    filterBoards(boards, new Set<BoardStatus>(["done"]), false, new Set()).map((b) => b.id),
  ).toEqual(["1", "3"]);
});

test("自分が更新したものだけに絞れる", () => {
  const result = filterBoards(
    boards,
    new Set<BoardStatus>(["done", "not_yet"]),
    true,
    new Set(["2", "3"]),
  );
  expect(result.map((b) => b.id)).toEqual(["2", "3"]);
});

test("自分が更新したものがなければ空", () => {
  expect(filterBoards(boards, new Set<BoardStatus>(["done"]), true, new Set())).toEqual([]);
});

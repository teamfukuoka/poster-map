import { fromPublicBoard, toPublicBoard } from "./public-status";
import { BOARD_STATUSES } from "./status";
import type { MapBoard } from "./types";

const board: MapBoard = {
  id: "b1",
  number: "東-1",
  name: "公民館前",
  address: "東区1-1",
  ward: "東区",
  lat: 33.6,
  long: 130.4,
  status: "error_wrong_poster",
};

test("一般向けの JSON には、他候補のポスターの状況の名前を出さない", () => {
  const json = JSON.stringify(toPublicBoard(board));
  expect(json).not.toContain("wrong_poster");
  expect(toPublicBoard(board).status).toBe("needs_check");
});

test.each(BOARD_STATUSES)("一般向けに変えて戻すと元の状況になる（%s）", (status) => {
  expect(fromPublicBoard(toPublicBoard({ ...board, status }))).toEqual({ ...board, status });
});

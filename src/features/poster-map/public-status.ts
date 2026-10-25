import type { BoardStatus } from "./status";
import type { MapBoard } from "./types";

/**
 * 一般向けの /api/boards では、他候補のポスターがあることを状況の名前からも出さない。
 * JSON をそのまま見ても分からないよう、通信の中だけ別の名前にする
 */
const PUBLIC_WIRE_STATUS = "needs_check";

export type PublicBoardStatus =
  | Exclude<BoardStatus, "error_wrong_poster">
  | typeof PUBLIC_WIRE_STATUS;

export type PublicBoard = Omit<MapBoard, "status"> & { status: PublicBoardStatus };

export function toPublicBoard(board: MapBoard): PublicBoard {
  if (board.status === "error_wrong_poster") return { ...board, status: PUBLIC_WIRE_STATUS };
  return { ...board, status: board.status };
}

export function fromPublicBoard(board: PublicBoard): MapBoard {
  if (board.status === PUBLIC_WIRE_STATUS) return { ...board, status: "error_wrong_poster" };
  return { ...board, status: board.status };
}

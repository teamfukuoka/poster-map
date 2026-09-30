// Derived from action-board (AGPL-3.0). See NOTICE.md. Modified 2026-10.
import type { BoardStatus } from "./status";

export function filterBoards<T extends { id: string; status: BoardStatus }>(
  boards: readonly T[],
  statuses: ReadonlySet<BoardStatus>,
  showOnlyMine: boolean,
  myBoardIds: ReadonlySet<string>,
): T[] {
  return boards.filter(
    (board) => statuses.has(board.status) && (!showOnlyMine || myBoardIds.has(board.id)),
  );
}

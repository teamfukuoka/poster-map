// Derived from action-board (AGPL-3.0). See NOTICE.md. Modified 2026-10.
import { useCallback, useMemo, useState } from "react";
import { filterBoards } from "./filter";
import { BOARD_STATUSES, type BoardStatus } from "./status";

export type BoardFilterState = {
  statuses: ReadonlySet<BoardStatus>;
  showOnlyMine: boolean;
};

export function useBoardFilter<T extends { id: string; status: BoardStatus }>(
  boards: readonly T[],
  myBoardIds: ReadonlySet<string>,
) {
  const [filterState, setFilterState] = useState<BoardFilterState>({
    statuses: new Set(BOARD_STATUSES),
    showOnlyMine: false,
  });

  const toggleStatus = useCallback((status: BoardStatus) => {
    setFilterState((prev) => {
      const statuses = new Set(prev.statuses);
      if (statuses.has(status)) {
        statuses.delete(status);
      } else {
        statuses.add(status);
      }
      return { ...prev, statuses };
    });
  }, []);

  const toggleShowOnlyMine = useCallback(() => {
    setFilterState((prev) => ({ ...prev, showOnlyMine: !prev.showOnlyMine }));
  }, []);

  const selectAll = useCallback(() => {
    setFilterState((prev) => ({ ...prev, statuses: new Set(BOARD_STATUSES) }));
  }, []);

  const deselectAll = useCallback(() => {
    setFilterState((prev) => ({ ...prev, statuses: new Set() }));
  }, []);

  const filteredBoards = useMemo(
    () => filterBoards(boards, filterState.statuses, filterState.showOnlyMine, myBoardIds),
    [boards, filterState, myBoardIds],
  );

  return { filterState, filteredBoards, toggleStatus, toggleShowOnlyMine, selectAll, deselectAll };
}

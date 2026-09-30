import { WARDS } from "./area";
import { BOARD_STATUSES, type BoardStatus } from "./status";

export type StatusCounts = Record<BoardStatus, number>;

export type Summary = {
  total: number;
  counts: StatusCounts;
  /** 完了の割合（%、小数第1位） */
  donePercent: number;
};

export function emptyStatusCounts(): StatusCounts {
  return Object.fromEntries(BOARD_STATUSES.map((status) => [status, 0])) as StatusCounts;
}

export function countByStatus(boards: readonly { status: BoardStatus }[]): StatusCounts {
  const counts = emptyStatusCounts();
  for (const board of boards) {
    counts[board.status] += 1;
  }
  return counts;
}

export function summarize(boards: readonly { status: BoardStatus }[]): Summary {
  const counts = countByStatus(boards);
  const total = boards.length;
  const donePercent = total === 0 ? 0 : Math.round((counts.done / total) * 1000) / 10;
  return { total, counts, donePercent };
}

export function summarizeByWard(
  boards: readonly { ward: string; status: BoardStatus }[],
): { ward: string; summary: Summary }[] {
  const byWard = new Map<string, { status: BoardStatus }[]>();
  for (const board of boards) {
    const list = byWard.get(board.ward) ?? [];
    list.push(board);
    byWard.set(board.ward, list);
  }
  const known: string[] = WARDS.filter((ward) => byWard.has(ward));
  const unknown = [...byWard.keys()].filter((ward) => !known.includes(ward));
  return [...known, ...unknown].map((ward) => ({
    ward,
    summary: summarize(byWard.get(ward) ?? []),
  }));
}

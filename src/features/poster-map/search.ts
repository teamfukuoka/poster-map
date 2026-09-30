// Derived from action-board (AGPL-3.0). See NOTICE.md. Modified 2026-10.
import type { MapBoard } from "./types";

export const SEARCH_MIN_QUERY_LENGTH = 2;
export const SEARCH_MAX_RESULTS = 10;

/**
 * 全角英数・記号を半角にし（NFKC）、小文字にし、空白を取り除く。
 * ハイフン類（‐ ‒ – — ― − など）と、数字に挟まれた長音の「ー」「ｰ」を - に揃える。
 */
export function normalizeForSearch(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[‐‑‒–—―−]/g, "-")
    .replace(/(\d)ー(?=\d)/g, "$1-");
}

export function searchBoards<T extends Pick<MapBoard, "number" | "name" | "address" | "ward">>(
  boards: readonly T[],
  query: string,
): T[] {
  const normalized = normalizeForSearch(query);
  if (normalized.length < SEARCH_MIN_QUERY_LENGTH) {
    return [];
  }
  const results: T[] = [];
  for (const board of boards) {
    const fields = [board.number, board.name, board.address, board.ward];
    if (fields.some((field) => normalizeForSearch(field).includes(normalized))) {
      results.push(board);
      if (results.length >= SEARCH_MAX_RESULTS) break;
    }
  }
  return results;
}

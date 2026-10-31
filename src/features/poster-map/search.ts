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

export const DISTRICT_MAX_RESULTS = 5;

/**
 * 番号（「筥松第二-6」）を投票区（「筥松第二」）と、その中の何番目か（「6」）に分ける。
 * 投票区は最後の「-数字」の前（DB の private.board_district と同じ）。形が違えば投票区は null。
 */
export function splitBoardNumber(number: string): { district: string | null; seq: string } {
  const match = /^(.+)-(\d+)$/.exec(number);
  return match ? { district: match[1], seq: match[2] } : { district: null, seq: number };
}

export type DistrictHit = { district: string; ward: string; count: number };

/** 投票区の名前で探す。前方一致を先に、あとは掲示板の並び順のまま */
export function searchDistricts<T extends Pick<MapBoard, "number" | "ward">>(
  boards: readonly T[],
  query: string,
): DistrictHit[] {
  const normalized = normalizeForSearch(query);
  if (normalized.length < SEARCH_MIN_QUERY_LENGTH) {
    return [];
  }
  const hits = new Map<string, DistrictHit & { starts: boolean }>();
  for (const board of boards) {
    const { district } = splitBoardNumber(board.number);
    if (!district) continue;
    const hit = hits.get(district);
    if (hit) {
      hit.count += 1;
      continue;
    }
    const name = normalizeForSearch(district);
    if (name.includes(normalized)) {
      hits.set(district, {
        district,
        ward: board.ward,
        count: 1,
        starts: name.startsWith(normalized),
      });
    }
  }
  return [...hits.values()]
    .sort((a, b) => Number(b.starts) - Number(a.starts))
    .slice(0, DISTRICT_MAX_RESULTS)
    .map(({ district, ward, count }) => ({ district, ward, count }));
}

export function districtOf(board: Pick<MapBoard, "number">): string | null {
  return splitBoardNumber(board.number).district;
}

/** 表示を絞る投票区を URL に残すときの名前。「?districts=馬出第一,馬出第二」 */
export const DISTRICTS_PARAM = "districts";

/**
 * URL の districts を読む。掲示板のデータにない投票区と重複は捨てる。
 * 担当の投票区を選んだ URL をブックマークしておけば、開くだけでその範囲が出る。
 */
export function parseDistrictsParam(
  search: string,
  boards: readonly Pick<MapBoard, "number">[],
): string[] {
  const value = new URLSearchParams(search).get(DISTRICTS_PARAM);
  if (!value) return [];
  const known = new Set(boards.map(districtOf));
  const names = value.split(",").map((name) => name.trim());
  return [...new Set(names)].filter((name) => name !== "" && known.has(name));
}

/** 今の URL の districts だけを差し替えた URL を返す（ほかの値と # はそのまま） */
export function withDistrictsParam(href: string, districts: readonly string[]): string {
  const url = new URL(href);
  if (districts.length > 0) {
    url.searchParams.set(DISTRICTS_PARAM, districts.join(","));
  } else {
    url.searchParams.delete(DISTRICTS_PARAM);
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

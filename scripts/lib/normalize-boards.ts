import { isInFukuokaCity, WARDS } from "../../src/features/poster-map/area";
import type { CsvRow } from "./read-csv";

export type NormalizedBoard = {
  number: string;
  name: string;
  address: string;
  ward: string;
  lat: number;
  long: number;
};

export type NormalizeResult = {
  boards: NormalizedBoard[];
  /** 「削除」として除いた番号 */
  removedNumbers: string[];
  /** 座標がなく、取り込めない番号 */
  missingCoordinates: string[];
  /** 同じ番号で座標の違う行があった番号（選び方の規則で1つに決めた） */
  conflicts: string[];
  /** 福岡市の範囲外の座標 */
  outOfArea: string[];
  /** 住所から区が分からない番号 */
  unknownWard: string[];
  /** 番号が空の行（番号の代わりに住所で示す） */
  missingNumber: string[];
  /** 「削除」以外のメモ */
  notes: { number: string; note: string }[];
};

export type NormalizeOptions = {
  /**
   * false（既定）: どれかの行が「削除」の番号は除く。
   * true: 「削除」の行だけを捨て、座標のある行が残っていれば掲示板として扱う。
   */
  includeRemoved?: boolean;
};

const REQUIRED_COLUMNS = ["number", "address", "name", "lat", "long"] as const;
const REMOVED_NOTE = "削除";
const WARD_PATTERN = `(?:${WARDS.join("|")})`;
/** 住所の先頭に区名が二重に付いている（例: 城南区早良区…） */
const DOUBLE_WARD = new RegExp(`^${WARD_PATTERN}(?=${WARD_PATTERN})`);
const LEADING_WARD = new RegExp(`^(${WARD_PATTERN})`);

function hasCoordinates(row: CsvRow): boolean {
  return (
    row.lat !== "" &&
    row.long !== "" &&
    Number.isFinite(Number(row.lat)) &&
    Number.isFinite(Number(row.long))
  );
}

export function normalizeBoards(
  rows: readonly CsvRow[],
  options: NormalizeOptions = {},
): NormalizeResult {
  if (rows.length > 0) {
    for (const column of REQUIRED_COLUMNS) {
      if (!(column in rows[0])) {
        throw new Error(`CSV に ${column} 列がありません`);
      }
    }
  }

  const missingNumber: string[] = [];
  const byNumber = new Map<string, CsvRow[]>();
  for (const row of rows) {
    if ((row.number ?? "").trim() === "") {
      missingNumber.push(row.address || "(住所なし)");
      continue;
    }
    const list = byNumber.get(row.number) ?? [];
    list.push(row);
    byNumber.set(row.number, list);
  }

  const result: NormalizeResult = {
    boards: [],
    removedNumbers: [],
    missingCoordinates: [],
    conflicts: [],
    outOfArea: [],
    unknownWard: [],
    missingNumber,
    notes: [],
  };

  for (const [number, group] of byNumber) {
    const isRemoved = (row: CsvRow) => (row.note ?? "") === REMOVED_NOTE;
    const candidates = group.filter((row) => !isRemoved(row));
    if (candidates.length === 0 || (!options.includeRemoved && group.some(isRemoved))) {
      result.removedNumbers.push(number);
      continue;
    }

    const withCoordinates = candidates.filter(hasCoordinates);
    const distinct = new Set(
      withCoordinates.map((row) => `${Number(row.lat)},${Number(row.long)}`),
    );
    if (distinct.size > 1) {
      result.conflicts.push(number);
    }

    let pool = withCoordinates.length > 0 ? withCoordinates : candidates;
    const singleWard = pool.filter((row) => !DOUBLE_WARD.test(row.address));
    if (singleWard.length > 0) {
      pool = singleWard;
    }
    const chosen = pool[pool.length - 1];

    const note = chosen.note ?? "";
    if (note !== "") {
      result.notes.push({ number, note });
    }

    if (!hasCoordinates(chosen)) {
      result.missingCoordinates.push(number);
      continue;
    }

    const address = chosen.address.replace(DOUBLE_WARD, "");
    const ward = address.match(LEADING_WARD)?.[1];
    if (!ward) {
      result.unknownWard.push(number);
    }

    const lat = Number(chosen.lat);
    const long = Number(chosen.long);
    if (!isInFukuokaCity(lat, long)) {
      result.outOfArea.push(number);
    }

    result.boards.push({ number, name: chosen.name, address, ward: ward ?? "", lat, long });
  }

  return result;
}

/** 取り込みを止めるべき問題の一覧（空なら取り込める） */
export function blockingProblems(result: NormalizeResult): string[] {
  const problems: string[] = [];
  if (result.missingNumber.length > 0) {
    problems.push(`番号がない: ${result.missingNumber.join(", ")}`);
  }
  if (result.missingCoordinates.length > 0) {
    problems.push(`座標がない: ${result.missingCoordinates.join(", ")}`);
  }
  if (result.outOfArea.length > 0) {
    problems.push(`福岡市の範囲外: ${result.outOfArea.join(", ")}`);
  }
  if (result.unknownWard.length > 0) {
    problems.push(`区が分からない: ${result.unknownWard.join(", ")}`);
  }
  const review = result.notes.filter((item) => item.note.startsWith("要確認"));
  if (review.length > 0) {
    problems.push(`要確認のメモが残っている: ${review.map((item) => item.number).join(", ")}`);
  }
  return problems;
}

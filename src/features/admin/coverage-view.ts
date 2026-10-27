// カバー地域の画面用の純関数。DB・Next.js に依存しない。
import { WARDS } from "@/features/poster-map/area";
import type {
  CoverageAssignee,
  CoverageBoard,
  CoverageKind,
  CoverageRange,
  CoverageSummaryRow,
} from "./types";

const KINDS: readonly CoverageKind[] = ["ward", "school", "town", "chome"];

function kindOrder(kind: CoverageKind): number {
  return KINDS.indexOf(kind);
}

function wardOrder(ward: string | null): number {
  if (ward === null) return WARDS.length + 1;
  const index = (WARDS as readonly string[]).indexOf(ward);
  return index === -1 ? WARDS.length : index;
}

/** 「1丁目」「10丁目」を数の順にするため、数字は数として比べる */
function compareText(a: string | null, b: string | null): number {
  return (a ?? "").localeCompare(b ?? "", "ja", { numeric: true });
}

export type Place = {
  kind: CoverageKind;
  range: CoverageRange;
  label: string;
  wards: string[];
  boardCount: number;
};

function isKind(value: unknown): value is CoverageKind {
  return typeof value === "string" && (KINDS as readonly string[]).includes(value);
}

function stringOrNull(value: unknown): string | null | undefined {
  if (value === null || value === undefined) return null;
  return typeof value === "string" ? value : undefined;
}

/** Server Action の入口で形を確かめる。形が違えば null（地名が掲示場のデータにあるかは DB が見る） */
export function parseRanges(value: unknown): CoverageRange[] | null {
  if (!Array.isArray(value)) return null;
  const out: CoverageRange[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null || Array.isArray(item)) return null;
    const o = item as Record<string, unknown>;
    if (!isKind(o.kind)) return null;
    const ward = stringOrNull(o.ward);
    const school = stringOrNull(o.school);
    const town = stringOrNull(o.town);
    const chome = stringOrNull(o.chome);
    if (ward === undefined || school === undefined || town === undefined || chome === undefined) {
      return null;
    }
    out.push({ kind: o.kind, ward, school, town, chome });
  }
  return out;
}

export function rangeLabel(r: CoverageRange): string {
  switch (r.kind) {
    case "ward":
      return r.ward ?? "";
    case "school":
      return `${r.school ?? ""}（校区）`;
    case "town":
      return `${r.ward ?? ""} ${r.town ?? ""}`;
    case "chome":
      return `${r.ward ?? ""} ${r.town ?? ""} ${r.chome ?? ""}`;
  }
}

/** 重なりの判定と React の key */
export function rangeKey(r: CoverageRange): string {
  return JSON.stringify([r.kind, r.ward, r.school, r.town, r.chome]);
}

/** 選べる場所の一覧。校区は区をまたいで 1 つにまとめる（school が null の行は除く） */
export function buildPlaces(summary: CoverageSummaryRow[]): Place[] {
  const places: Place[] = [];
  const schools = new Map<string, Place>();
  for (const r of summary) {
    if (r.unit === "school") {
      if (r.school === null) continue;
      const existing = schools.get(r.school);
      if (existing) {
        existing.boardCount += r.total;
        if (r.ward !== null && !existing.wards.includes(r.ward)) existing.wards.push(r.ward);
        continue;
      }
      const range: CoverageRange = {
        kind: "school",
        ward: null,
        school: r.school,
        town: null,
        chome: null,
      };
      const place: Place = {
        kind: "school",
        range,
        label: rangeLabel(range),
        wards: r.ward === null ? [] : [r.ward],
        boardCount: r.total,
      };
      schools.set(r.school, place);
      places.push(place);
      continue;
    }
    let range: CoverageRange;
    if (r.unit === "ward") {
      if (r.ward === null) continue;
      range = { kind: "ward", ward: r.ward, school: null, town: null, chome: null };
    } else if (r.unit === "town") {
      if (r.ward === null || r.town === null) continue;
      range = { kind: "town", ward: r.ward, school: null, town: r.town, chome: null };
    } else {
      if (r.ward === null || r.town === null || r.chome === null) continue;
      range = { kind: "chome", ward: r.ward, school: null, town: r.town, chome: r.chome };
    }
    places.push({
      kind: r.unit,
      range,
      label: rangeLabel(range),
      wards: [r.ward as string],
      boardCount: r.total,
    });
  }
  for (const p of schools.values()) p.wards.sort((a, b) => wardOrder(a) - wardOrder(b));
  return places;
}

/** label に query（前後の空白を除く）を含む場所。kind の順、次に label の順。空なら [] */
export function searchPlaces(places: Place[], query: string, limit = 20): Place[] {
  const q = query.trim();
  if (q === "") return [];
  return places
    .filter((p) => p.label.includes(q))
    .sort((a, b) => kindOrder(a.kind) - kindOrder(b.kind) || compareText(a.label, b.label))
    .slice(0, limit);
}

function nameOf(r: CoverageSummaryRow): string | null {
  if (r.unit === "school") return r.school;
  if (r.unit === "town") return r.town;
  if (r.unit === "chome") return r.chome;
  return r.ward;
}

/** unit の行だけ（town のときも丁目の行は含めない）。並びは none の多い順、同じなら区の順、地名の順 */
export function filterSummary(
  rows: CoverageSummaryRow[],
  opts: { unit: CoverageKind; ward: string | null; onlyGaps: boolean },
): CoverageSummaryRow[] {
  return rows
    .filter(
      (r) =>
        r.unit === opts.unit &&
        (opts.ward === null || r.ward === opts.ward) &&
        (!opts.onlyGaps || r.none > 0),
    )
    .sort(
      (a, b) =>
        b.none - a.none ||
        wardOrder(a.ward) - wardOrder(b.ward) ||
        compareText(nameOf(a), nameOf(b)),
    );
}

/** 町名の下の丁目の行（丁目の数の順） */
export function chomeRowsOf(
  rows: CoverageSummaryRow[],
  ward: string,
  town: string,
): CoverageSummaryRow[] {
  return rows
    .filter((r) => r.unit === "chome" && r.ward === ward && r.town === town)
    .sort((a, b) => compareText(a.chome, b.chome));
}

function isInRow(b: CoverageBoard, row: CoverageSummaryRow): boolean {
  if (b.ward !== row.ward) return false;
  if (row.unit === "school") return b.school === row.school;
  if (row.unit === "town") return b.town === row.town;
  if (row.unit === "chome") return b.town === row.town && b.chome === row.chome;
  return true;
}

/** 集計の行に数えられた掲示場 */
export function boardsInRow(boards: CoverageBoard[], row: CoverageSummaryRow): CoverageBoard[] {
  return boards.filter((b) => isInRow(b, row));
}

/** 全体の数。unit='ward' の行を足す（校区・町名の表にない掲示場も区には入る） */
export function totalsOf(summary: CoverageSummaryRow[]): {
  total: number;
  assigned: number;
  reserved: number;
  none: number;
} {
  const sum = { total: 0, assigned: 0, reserved: 0, none: 0 };
  for (const r of summary) {
    if (r.unit !== "ward") continue;
    sum.total += r.total;
    sum.assigned += r.assigned;
    sum.reserved += r.reserved;
    sum.none += r.none;
  }
  return sum;
}

/** `312（82%）`。四捨五入。total が 0 なら `0（—）` */
export function formatShare(count: number, total: number): string {
  if (total === 0) return `${count}（—）`;
  return `${count}（${Math.round((count / total) * 100)}%）`;
}

/**
 * 練習の掲示場が残っている間だけ出す注記の終わり（公開期間の始まり）。
 * dashboard-view の STALE_TABLE_FROM と同じ形で比べる。
 */
export const REHEARSAL_NOTE_UNTIL = "2026-11-01T00:00:00+09:00";

export function isRehearsalNotePeriod(now: Date = new Date()): boolean {
  return now < new Date(REHEARSAL_NOTE_UNTIL);
}

/** 前後の空白を取って同じ呼び名があるか（exceptId の本人は除く） */
export function hasSameLabel(
  assignees: CoverageAssignee[],
  label: string,
  exceptId?: string,
): boolean {
  const target = label.trim();
  return assignees.some((a) => a.id !== exceptId && a.label.trim() === target);
}

/** 呼び名か、範囲の名前のどれかに query を含む担当者。空なら全員 */
export function filterAssignees(assignees: CoverageAssignee[], query: string): CoverageAssignee[] {
  const q = query.trim();
  if (q === "") return assignees;
  return assignees.filter(
    (a) => a.label.includes(q) || a.ranges.some((r) => rangeLabel(r).includes(q)),
  );
}

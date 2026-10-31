// カバー地域の画面用の純関数。DB・Next.js に依存しない。
import { WARDS } from "@/features/poster-map/area";
import type {
  CoverageAssignee,
  CoverageBoard,
  CoverageKind,
  CoverageRange,
  CoverageSummaryRow,
} from "./types";

const KINDS: readonly CoverageKind[] = ["ward", "district", "school", "town", "chome"];

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
    const district = stringOrNull(o.district);
    const school = stringOrNull(o.school);
    const town = stringOrNull(o.town);
    const chome = stringOrNull(o.chome);
    if (
      ward === undefined ||
      district === undefined ||
      school === undefined ||
      town === undefined ||
      chome === undefined
    ) {
      return null;
    }
    out.push({ kind: o.kind, ward, district, school, town, chome });
  }
  return out;
}

/** board_areas.chome は数字だけ（"3"）。画面には「3丁目」と出す */
export function chomeLabel(chome: string): string {
  return `${chome}丁目`;
}

export function rangeLabel(r: CoverageRange): string {
  switch (r.kind) {
    case "ward":
      return r.ward ?? "";
    case "district":
      return `${r.ward ?? ""} ${r.district ?? ""}（投票区）`;
    case "school":
      return `${r.school ?? ""}（校区）`;
    case "town":
      return `${r.ward ?? ""} ${r.town ?? ""}`;
    case "chome":
      return `${r.ward ?? ""} ${r.town ?? ""} ${r.chome === null ? "" : chomeLabel(r.chome)}`;
  }
}

/** 重なりの判定と React の key */
export function rangeKey(r: CoverageRange): string {
  return JSON.stringify([r.kind, r.ward, r.district, r.school, r.town, r.chome]);
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
        district: null,
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
    const empty = { district: null, school: null, town: null, chome: null };
    if (r.unit === "ward") {
      if (r.ward === null) continue;
      range = { ...empty, kind: "ward", ward: r.ward };
    } else if (r.unit === "district") {
      if (r.ward === null || r.district === null) continue;
      range = { ...empty, kind: "district", ward: r.ward, district: r.district };
    } else if (r.unit === "town") {
      if (r.ward === null || r.town === null) continue;
      range = { ...empty, kind: "town", ward: r.ward, town: r.town };
    } else {
      if (r.ward === null || r.town === null || r.chome === null) continue;
      range = { ...empty, kind: "chome", ward: r.ward, town: r.town, chome: r.chome };
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

function stripSpaces(text: string): string {
  return text.replace(/[\s\u3000]+/g, "");
}

/**
 * label に query を含む場所。空白（半角・全角）は query にも label にも無視する。
 * kind の順、次に label の順に並べ、limit 件まで。切った残りの件数を more で返す。query が空なら空
 */
export function searchPlaces(
  places: Place[],
  query: string,
  limit = 20,
): { places: Place[]; more: number } {
  const q = stripSpaces(query);
  if (q === "") return { places: [], more: 0 };
  const hits = places
    .filter((p) => stripSpaces(p.label).includes(q))
    .sort((a, b) => kindOrder(a.kind) - kindOrder(b.kind) || compareText(a.label, b.label));
  return { places: hits.slice(0, limit), more: Math.max(0, hits.length - limit) };
}

function nameOf(r: CoverageSummaryRow): string | null {
  if (r.unit === "district") return r.district;
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
  if (row.unit === "district") return b.district === row.district;
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

/** リハーサルの期間に出す一文（カバー地域の画面と最初の画面で同じ） */
export const REHEARSAL_NOTE = "10/31 までの予約・貼ったはリハーサルの報告です";

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

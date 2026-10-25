import { WARDS } from "@/features/poster-map/area";
import type { SiteState, WardProgress } from "./types";

export type SiteStateLabel = "公開中" | "止めている" | "期間外";

function wardOrder(ward: string): number {
  const index = (WARDS as readonly string[]).indexOf(ward);
  return index === -1 ? WARDS.length : index;
}

/** WARDS の順に並べる。WARDS にない区は末尾（渡された順のまま） */
export function sortWardProgress(rows: WardProgress[]): WardProgress[] {
  return [...rows].sort((a, b) => wardOrder(a.ward) - wardOrder(b.ward));
}

/**
 * 公開の状態。期間内に force_hidden で止めているときだけ「止めている」。
 * 期間外は止めていても「期間外」（止めても止めなくても見えないため）。
 */
export function siteStateLabel(s: SiteState, now: Date = new Date()): SiteStateLabel {
  const inPeriod = now >= new Date(s.public_from) && now < new Date(s.public_until);
  if (s.force_hidden && inPeriod) return "止めている";
  return s.is_public ? "公開中" : "期間外";
}

/** 長く残っている予約の表を出し始める時刻（11/1 8:00 から6時間） */
export const STALE_TABLE_FROM = "2026-11-01T14:00:00+09:00";

export function isBeforeStaleTable(now: Date = new Date()): boolean {
  return now < new Date(STALE_TABLE_FROM);
}

/** 日本時間で出す。null・空・読めない値は「—」 */
export function formatJst(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
}

/** null・空は「—」。連絡事項などの表示用（テキストとして返す。HTML にはしない） */
export function textOrDash(value: string | null | undefined): string {
  return value?.trim() ? value : "—";
}

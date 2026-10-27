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

/** 区ごとの進み具合の合計（全数・計画・実績） */
export function sumWardProgress(rows: WardProgress[]): {
  total: number;
  planned: number;
  done: number;
} {
  const sum = { total: 0, planned: 0, done: 0 };
  for (const r of rows) {
    sum.total += r.total;
    sum.planned += r.planned;
    sum.done += r.done;
  }
  return sum;
}

/** 公開の状態。force_hidden で止めていれば、期間の内外にかかわらず「止めている」 */
export function siteStateLabel(s: SiteState): SiteStateLabel {
  if (s.force_hidden) return "止めている";
  return s.is_public ? "公開中" : "期間外";
}

/**
 * 長く残っている予約の表を出し始める時刻（11/1 8:00 から6時間）。
 * DB の admin_settings.stale_reserved_after（supabase/migrations/20261025000000_admin.sql）と同じ値にそろえること。
 * 片方を変えたら、もう片方も変える。
 */
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

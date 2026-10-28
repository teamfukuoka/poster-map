// カバー地域の地図用の純関数。Leaflet・Next.js に依存しない。
import { escapeHtml } from "@/features/poster-map/html";
import type { CoverageBoard, CoverageStatus } from "./types";

/**
 * 点の色と大きさ。担当なしの赤を一番大きく、担当ありの灰色を一番小さくして、
 * 灰色の点に赤が埋もれないようにする。
 * 公開の地図の予約（橙 #F59E0B）・エラー（赤 #EF4444）とは別の画面なので、
 * ここでは黄（#EAB308）と濃い赤（#DC2626）にして、地図の上でも見分けがつくようにする。
 */
export function markerStyle(c: CoverageStatus): { color: string; radius: number } {
  switch (c) {
    case "none":
      return { color: "#DC2626", radius: 7 };
    case "reserved":
      return { color: "#EAB308", radius: 5 };
    case "assigned":
      return { color: "#9CA3AF", radius: 3 };
  }
}

/** 地図の点のツールチップ。値はすべて escapeHtml を通す */
export function coverageTooltipHtml(b: CoverageBoard): string {
  const town = [b.town, b.chome].filter((v): v is string => !!v).join(" ");
  const assignees = b.assignee_labels.length > 0 ? b.assignee_labels.join("、") : "担当なし";
  const lines = [
    `<strong>${escapeHtml(b.name ? `${b.number} ${b.name}` : b.number)}</strong>`,
    escapeHtml(b.address),
    `校区: ${escapeHtml(b.school ?? "不明")}`,
    `町名: ${escapeHtml(town || "不明")}`,
    `担当: ${escapeHtml(assignees)}`,
  ];
  return lines.join("<br>");
}

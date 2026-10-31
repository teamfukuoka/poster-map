// カバー地域の地図用の純関数。Leaflet・Next.js に依存しない。
import { escapeHtml } from "@/features/poster-map/html";
import { chomeLabel } from "./coverage-view";
import type { CoverageBoard, CoverageStatus } from "./types";

/**
 * 点の色と大きさ。color は縁、fillColor は塗り。
 * 担当なしの赤を一番大きく、担当ありの灰色を一番小さくして、灰色の点に赤が埋もれないようにする。
 * 灰色は地図のタイルに溶けやすいので、担当ありだけ濃い縁をつける。
 * 予約あり（黄 #EAB308）は公開の地図の「予約」と同じ意味なので、近い黄にしてある。
 * この地図にはエラーの状態は出ないので、赤（#DC2626）は担当なしだけを表す。
 */
export function markerStyle(c: CoverageStatus): {
  color: string;
  fillColor: string;
  radius: number;
} {
  switch (c) {
    case "none":
      return { color: "#DC2626", fillColor: "#DC2626", radius: 7 };
    case "reserved":
      return { color: "#EAB308", fillColor: "#EAB308", radius: 5 };
    case "assigned":
      return { color: "#374151", fillColor: "#9CA3AF", radius: 4 };
  }
}

/** 地図の点のツールチップ。値はすべて escapeHtml を通す */
export function coverageTooltipHtml(b: CoverageBoard): string {
  const town = [b.town, b.chome ? chomeLabel(b.chome) : null]
    .filter((v): v is string => !!v)
    .join(" ");
  const assignees = b.assignee_labels.length > 0 ? b.assignee_labels.join("、") : "担当なし";
  const lines = [
    `<strong>${escapeHtml(b.name ? `${b.number} ${b.name}` : b.number)}</strong>`,
    escapeHtml(b.address),
    `投票区: ${escapeHtml(b.district ?? "不明")}`,
    `町名: ${escapeHtml(town || "不明")}`,
    `担当: ${escapeHtml(assignees)}`,
  ];
  return lines.join("<br>");
}

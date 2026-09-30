// Derived from action-board (AGPL-3.0). See NOTICE.md. Modified 2026-10.
import { escapeHtml } from "./html";
import type { StatusCounts } from "./stats";
import { type BoardStatus, PIE_ORDER, STATUS_CONFIG } from "./status";
import type { MapBoard } from "./types";

export function markerIconHtml(status: BoardStatus): string {
  return `<div style="background-color: ${STATUS_CONFIG[status].color}; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`;
}

export function pieSegmentsSvg(counts: StatusCounts, total: number, size: number): string {
  const radius = (size - 6) / 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;
  const segments: string[] = [];
  let cumulative = 0;

  for (const status of PIE_ORDER) {
    const count = counts[status];
    if (count === 0) continue;
    const ratio = count / total;
    const color = STATUS_CONFIG[status].color;

    if (ratio >= 1) {
      segments.push(`<circle cx="${center}" cy="${center}" r="${radius}" fill="${color}" />`);
      break;
    }

    const strokeLength = circumference * ratio;
    const rotation = cumulative * 360 - 90;
    segments.push(
      `<circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="${color}" stroke-width="${radius * 2}" stroke-dasharray="${strokeLength} ${circumference - strokeLength}" transform="rotate(${rotation} ${center} ${center})" />`,
    );
    cumulative += ratio;
  }

  return segments.join("");
}

export function clusterIconHtml(counts: StatusCounts): { html: string; size: number } {
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  const size = total < 10 ? 35 : total < 100 ? 45 : 55;
  const fontSize = size < 40 ? 11 : size < 50 ? 13 : 15;
  const present = PIE_ORDER.filter((status) => counts[status] > 0);

  let inner: string;
  if (present.length > 1) {
    inner = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="position: absolute; top: -3px; left: -3px;">${pieSegmentsSvg(counts, total, size)}<text x="${size / 2}" y="${size / 2}" text-anchor="middle" dominant-baseline="central" fill="white" font-size="${fontSize}px" font-weight="bold" style="text-shadow: 2px 2px 4px rgba(0,0,0,0.8);">${total}</text></svg>`;
  } else {
    const color = STATUS_CONFIG[present[0] ?? "not_yet"].color;
    inner = `<div style="background-color: ${color}; width: calc(100% + 6px); height: calc(100% + 6px); border-radius: 50%; position: absolute; top: -3px; left: -3px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: ${fontSize}px; text-shadow: 2px 2px 4px rgba(0,0,0,0.8);">${total}</div>`;
  }

  return {
    size,
    html: `<div style="width: ${size}px; height: ${size}px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3); position: relative; overflow: hidden;">${inner}</div>`,
  };
}

export function clusterTooltipHtml(counts: StatusCounts): string {
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  const lines = PIE_ORDER.filter((status) => counts[status] > 0).map(
    (status) => `${STATUS_CONFIG[status].shortLabel}: ${counts[status]}`,
  );
  return [`掲示板数: ${total}`, ...lines].join("<br>");
}

export function boardTooltipHtml(
  board: Pick<MapBoard, "number" | "name" | "address">,
  sameLocationCount: number,
): string {
  const lines = [
    `#${escapeHtml(board.number)} ${escapeHtml(board.name)}`,
    escapeHtml(board.address),
  ];
  if (sameLocationCount > 1) {
    lines.push(`<small>※この位置に${sameLocationCount}件の掲示板があります</small>`);
  }
  return lines.join("<br>");
}

/** 同じ座標に複数の掲示板があるとき、重ならないよう円周上に少しずらす（約10〜15m） */
export function offsetPosition(
  lat: number,
  long: number,
  index: number,
  count: number,
): [number, number] {
  if (count <= 1) return [lat, long];
  const angle = ((index * 360) / count) * (Math.PI / 180);
  const radius = 0.0001 + index * 0.00005;
  return [lat + radius * Math.cos(angle), long + radius * Math.sin(angle)];
}

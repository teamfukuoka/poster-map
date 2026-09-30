// Derived from action-board (AGPL-3.0). See NOTICE.md. Modified 2026-10.
import type L from "leaflet";
import type { MapBoard } from "./types";

export type FlyMap = Pick<L.Map, "getZoom" | "getCenter" | "once" | "flyTo">;

/** この距離（メートル）より近ければ、すでにその位置にいるとみなす */
const SAME_PLACE_METERS = 1;

/**
 * 掲示板まで地図を動かし、着いたら onArrive を呼ぶ（検索で選んだとき用）。
 * 移動の間に別の掲示板が選ばれていたら（isLatest が false）呼ばない。
 * すでにその位置とズームにいるときは moveend が来ないことがあるので、動かさずにすぐ呼ぶ。
 */
export function flyToBoard(
  map: FlyMap,
  board: MapBoard,
  zoom: number,
  isLatest: (board: MapBoard) => boolean,
  onArrive: (board: MapBoard) => void,
): void {
  const target: [number, number] = [board.lat, board.long];
  if (map.getZoom() === zoom && map.getCenter().distanceTo(target) < SAME_PLACE_METERS) {
    onArrive(board);
    return;
  }
  map.once("moveend", () => {
    if (isLatest(board)) onArrive(board);
  });
  map.flyTo(target, zoom, { duration: 1 });
}

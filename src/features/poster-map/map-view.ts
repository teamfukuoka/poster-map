// 地図の「ポスター｜シール」の切り替え。マーカーの色・クラスタの内訳・集計を、表示ごとに決める。
import { WARDS } from "./area";
import { countByStatus, type StatusCounts } from "./stats";
import { PIE_ORDER, STATUS_CONFIG, statusLabels } from "./status";
import {
  isStickerTarget,
  STICKER_PIE_ORDER,
  STICKER_STATUS_CONFIG,
  STICKER_STATUSES,
  type StickerStatus,
} from "./sticker-status";
import type { MapBoard } from "./types";

export type MapMode = "poster" | "sticker";

/** 選んだ表示を URL に残すときの名前。「?view=sticker」 */
export const VIEW_PARAM = "view";

/**
 * URL の view を読む。シールを始めていなければ、いつもポスター。
 * シールを始めている間は、指定がなければシール（ポスターのまま報告してしまわないように）。
 */
export function parseViewParam(search: string, stickerEnabled: boolean): MapMode {
  if (!stickerEnabled) return "poster";
  return new URLSearchParams(search).get(VIEW_PARAM) === "poster" ? "poster" : "sticker";
}

/** 今の URL の view だけを差し替えた URL を返す（ほかの値と # はそのまま）。null なら消す */
export function withViewParam(href: string, mode: MapMode | null): string {
  const url = new URL(href);
  if (mode) {
    url.searchParams.set(VIEW_PARAM, mode);
  } else {
    url.searchParams.delete(VIEW_PARAM);
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

/** シールの表示での区分。ポスターが完了でない掲示板は「対象外」（シールが未のとき） */
export type StickerDisplay = StickerStatus | "not_target";

export const STICKER_DISPLAYS: readonly StickerDisplay[] = [...STICKER_STATUSES, "not_target"];

export const NOT_TARGET = {
  label: "対象外（ポスター未完了）",
  shortLabel: "対象外",
  color: "#D4D4D4",
};

/** 円グラフ・集計の順 */
export const STICKER_DISPLAY_ORDER: readonly StickerDisplay[] = [
  ...STICKER_PIE_ORDER,
  "not_target",
];

export function stickerDisplayConfig(display: StickerDisplay): {
  label: string;
  shortLabel: string;
  color: string;
} {
  return display === "not_target" ? NOT_TARGET : STICKER_STATUS_CONFIG[display];
}

/**
 * シールの表示での区分。予約・完了・問題ありは、ポスターの状態にかかわらずそのまま出す
 * （シールを貼ったあとでポスターの状態が変わっても、報告が見えなくならないように）。
 */
export function stickerDisplayOf(
  board: Pick<MapBoard, "status">,
  sticker: StickerStatus | undefined,
): StickerDisplay {
  const status = sticker ?? "not_yet";
  if (status !== "not_yet") return status;
  return isStickerTarget(board.status) ? "not_yet" : "not_target";
}

/** クラスタの円グラフ・吹き出しの 1 区分 */
export type Segment = { label: string; color: string; count: number };

export function posterSegments(counts: StatusCounts, isVolunteer: boolean): Segment[] {
  return PIE_ORDER.map((status) => ({
    label: statusLabels(status, isVolunteer).shortLabel,
    color: STATUS_CONFIG[status].color,
    count: counts[status],
  }));
}

export type StickerCounts = Record<StickerDisplay, number>;

export function countStickerDisplays(
  boards: readonly Pick<MapBoard, "id" | "status">[],
  stickers: ReadonlyMap<string, StickerStatus>,
): StickerCounts {
  const counts = Object.fromEntries(STICKER_DISPLAYS.map((d) => [d, 0])) as StickerCounts;
  for (const board of boards) {
    counts[stickerDisplayOf(board, stickers.get(board.id))] += 1;
  }
  return counts;
}

export function stickerSegments(counts: StickerCounts): Segment[] {
  return STICKER_DISPLAY_ORDER.map((display) => {
    const { shortLabel, color } = stickerDisplayConfig(display);
    return { label: shortLabel, color, count: counts[display] };
  });
}

export type StickerSummary = {
  /** 対象（ポスターが完了の掲示板） */
  target: number;
  counts: StickerCounts;
  /** シール完了の割合（対象に対する %、小数第1位。100 を超えない） */
  donePercent: number;
};

export function summarizeStickers(
  boards: readonly Pick<MapBoard, "id" | "status">[],
  stickers: ReadonlyMap<string, StickerStatus>,
): StickerSummary {
  const counts = countStickerDisplays(boards, stickers);
  const target = boards.filter((b) => isStickerTarget(b.status)).length;
  const donePercent =
    target === 0 ? 0 : Math.min(100, Math.round((counts.done / target) * 1000) / 10);
  return { target, counts, donePercent };
}

/** 地図に渡す表示。マーカーの色と、クラスタの内訳を決める */
export type MapView = {
  marker: (board: MapBoard) => { color: string; faded: boolean };
  segments: (boards: readonly MapBoard[]) => Segment[];
};

export function posterView(isVolunteer: boolean): MapView {
  return {
    marker: (board) => ({ color: STATUS_CONFIG[board.status].color, faded: false }),
    segments: (boards) => posterSegments(countByStatus(boards), isVolunteer),
  };
}

export function stickerView(stickers: ReadonlyMap<string, StickerStatus>): MapView {
  return {
    marker: (board) => {
      const display = stickerDisplayOf(board, stickers.get(board.id));
      return { color: stickerDisplayConfig(display).color, faded: display === "not_target" };
    },
    segments: (boards) => stickerSegments(countStickerDisplays(boards, stickers)),
  };
}

/** 区ごとのシールの集計（ポスターの「区ごとの状況」と同じ区の順） */
export function summarizeStickersByWard(
  boards: readonly Pick<MapBoard, "id" | "status" | "ward">[],
  stickers: ReadonlyMap<string, StickerStatus>,
): { ward: string; summary: StickerSummary }[] {
  const byWard = new Map<string, Pick<MapBoard, "id" | "status" | "ward">[]>();
  for (const board of boards) {
    const list = byWard.get(board.ward) ?? [];
    list.push(board);
    byWard.set(board.ward, list);
  }
  const known: string[] = WARDS.filter((ward) => byWard.has(ward));
  const unknown = [...byWard.keys()].filter((ward) => !known.includes(ward));
  return [...known, ...unknown].map((ward) => ({
    ward,
    summary: summarizeStickers(byWard.get(ward) ?? [], stickers),
  }));
}

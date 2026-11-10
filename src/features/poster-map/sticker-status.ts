// シールの状態。DB の enum（supabase/migrations/*_stickers.sql）と同じ値。一致は types.ts で型検査している。
// 予約・完了にできるのは、ポスターが完了（done）の掲示場だけ（DB の update_sticker_status で検査）。
import type { BoardStatus } from "./status";

export const STICKER_STATUSES = ["not_yet", "reserved", "done", "issue"] as const;

export type StickerStatus = (typeof STICKER_STATUSES)[number];

export type StickerStatusConfig = {
  label: string;
  shortLabel: string;
  color: string;
};

export const STICKER_STATUS_CONFIG: Record<StickerStatus, StickerStatusConfig> = {
  not_yet: { label: "シール未", shortLabel: "未", color: "#757575" },
  reserved: { label: "予約", shortLabel: "予約", color: "#F59E0B" },
  done: { label: "シール完了", shortLabel: "完了", color: "#00AFCC" },
  issue: {
    label: "問題あり（ポスターが剥がれている・破れているなど。詳細をメモに記載）",
    shortLabel: "問題あり",
    color: "#EF4444",
  },
};

/** 報告ダイアログの選択肢の順 */
export const STICKER_SELECT_ORDER: readonly StickerStatus[] = [
  "not_yet",
  "reserved",
  "done",
  "issue",
];

/** 集計表示の順 */
export const STICKER_PIE_ORDER: readonly StickerStatus[] = ["done", "reserved", "not_yet", "issue"];

/** ポスターが完了でないと選べない状態 */
const NEEDS_POSTER_DONE: ReadonlySet<StickerStatus> = new Set(["reserved", "done"]);

/** その掲示場で、シールをこの状態にできるか（DB の検査と同じ条件） */
export function canSetSticker(status: StickerStatus, posterStatus: BoardStatus): boolean {
  return !NEEDS_POSTER_DONE.has(status) || posterStatus === "done";
}

/** シールの対象（ポスターが完了の掲示場） */
export function isStickerTarget(posterStatus: BoardStatus): boolean {
  return posterStatus === "done";
}

export function isStickerStatus(value: unknown): value is StickerStatus {
  return typeof value === "string" && (STICKER_STATUSES as readonly string[]).includes(value);
}

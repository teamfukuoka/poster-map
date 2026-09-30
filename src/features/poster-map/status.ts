// Derived from action-board (AGPL-3.0). See NOTICE.md. Modified 2026-10.
// DB の enum（supabase/migrations/*_poster_map.sql）と同じ値。一致は types.ts で型検査している。
export const BOARD_STATUSES = [
  "not_yet",
  "not_yet_dangerous",
  "reserved",
  "done",
  "error_wrong_poster",
  "other",
] as const;

export type BoardStatus = (typeof BOARD_STATUSES)[number];

export type StatusGroup = "status" | "error" | "other";

export type StatusConfig = {
  label: string;
  shortLabel: string;
  color: string;
  group: StatusGroup;
};

export const STATUS_CONFIG: Record<BoardStatus, StatusConfig> = {
  not_yet: { label: "未貼付", shortLabel: "未貼付", color: "#6B7280", group: "status" },
  not_yet_dangerous: {
    label: "未貼付（貼り付けに危険が伴う）",
    shortLabel: "未貼付（危険）",
    color: "#6B7280",
    group: "status",
  },
  reserved: { label: "予約", shortLabel: "予約", color: "#F59E0B", group: "status" },
  done: { label: "完了", shortLabel: "完了", color: "#10B981", group: "status" },
  error_wrong_poster: {
    label: "エラー（他候補のポスターが貼られている）",
    shortLabel: "他候補",
    color: "#EF4444",
    group: "error",
  },
  other: {
    label: "その他（詳細をメモに記載）",
    shortLabel: "その他",
    color: "#8B5CF6",
    group: "other",
  },
};

/** 報告ダイアログの選択肢の順 */
export const STATUS_SELECT_ORDER: readonly BoardStatus[] = [
  "not_yet",
  "reserved",
  "done",
  "not_yet_dangerous",
  "error_wrong_poster",
  "other",
];

/** クラスタの円グラフ・集計表示の順 */
export const PIE_ORDER: readonly BoardStatus[] = [
  "done",
  "reserved",
  "not_yet",
  "not_yet_dangerous",
  "error_wrong_poster",
  "other",
];

export function isBoardStatus(value: unknown): value is BoardStatus {
  return typeof value === "string" && (BOARD_STATUSES as readonly string[]).includes(value);
}

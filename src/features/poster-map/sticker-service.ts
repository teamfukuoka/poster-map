// ポスターシール貼りチャレンジ。Next.js に依存しない。クライアントを引数で受け取り、統合テストから直接呼ぶ。
// シールの状態と履歴は参加中のボランティアだけが読める（RLS）。一般の人には返さない。
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { fetchAllPages } from "./boards-query";
import { toUserMessage } from "./errors";
import { BULK_RESERVE_MAX, HISTORY_LIMIT, NOTE_MAX_LENGTH } from "./limits";
import { isStickerStatus, type StickerStatus } from "./sticker-status";
import type { ActionResult } from "./types";

type Client = SupabaseClient<Database>;

/** シールが「未」でない掲示板の状態。行がない掲示板は「未」 */
export type StickerEntry = { boardId: string; status: StickerStatus };

export type StickerState = {
  /** 管理画面で「シールを始める」が ON か。OFF なら地図に切り替えを出さない */
  enabled: boolean;
  stickers: StickerEntry[];
  /** 自分の予約（いま予約のままで、最後に予約にしたのが自分） */
  myReservedIds: string[];
};

export type StickerHistoryItem = {
  id: string;
  previousStatus: StickerStatus;
  newStatus: StickerStatus;
  displayName: string;
  note: string | null;
  createdAt: string;
};

const OFF: StickerState = { enabled: false, stickers: [], myReservedIds: [] };

/** ボランティア用。OFF のときはシールの状態を取りに行かない */
export async function loadStickerState(client: Client): Promise<ActionResult<StickerState>> {
  const { data: enabled, error } = await client.rpc("is_sticker_enabled");
  if (error) return { ok: false, error: toUserMessage(error) };
  if (!enabled) return { ok: true, data: OFF };
  try {
    const [rows, reserved] = await Promise.all([
      fetchAllPages<{ board_id: string; status: StickerStatus }>((from, to) =>
        client
          .from("board_stickers")
          .select("board_id,status")
          .neq("status", "not_yet")
          .order("board_id")
          .range(from, to),
      ),
      client.rpc("my_reserved_sticker_board_ids"),
    ]);
    if (reserved.error) throw new Error(reserved.error.message);
    return {
      ok: true,
      data: {
        enabled: true,
        stickers: rows.map((row) => ({ boardId: row.board_id, status: row.status })),
        myReservedIds: reserved.data ?? [],
      },
    };
  } catch (e) {
    console.error("loadStickerState failed", e);
    return { ok: false, error: toUserMessage(null) };
  }
}

export async function loadStickerHistory(
  client: Client,
  boardId: string,
): Promise<ActionResult<StickerHistoryItem[]>> {
  const { data, error } = await client
    .from("sticker_status_history")
    .select("id,previous_status,new_status,display_name,note,created_at")
    .eq("board_id", boardId)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);
  if (error) return { ok: false, error: toUserMessage(error) };
  return {
    ok: true,
    data: data.map((row) => ({
      id: row.id,
      previousStatus: row.previous_status,
      newStatus: row.new_status,
      displayName: row.display_name,
      note: row.note,
      createdAt: row.created_at,
    })),
  };
}

export async function updateSticker(
  client: Client,
  input: { boardId: string; status: unknown; note: string },
): Promise<ActionResult<StickerEntry>> {
  if (!isStickerStatus(input.status)) {
    return { ok: false, error: toUserMessage(null) };
  }
  const note = input.note.trim();
  if (note.length > NOTE_MAX_LENGTH) {
    return { ok: false, error: toUserMessage({ message: "note_too_long" }) };
  }
  const { data, error } = await client.rpc("update_sticker_status", {
    p_board_id: input.boardId,
    p_status: input.status,
    p_note: note,
  });
  if (error || !data) return { ok: false, error: toUserMessage(error) };
  return { ok: true, data: { boardId: data.board_id, status: data.status } };
}

/**
 * 渡した掲示板のうち、ポスターが完了でシールが未のものだけを予約にする。予約にできた掲示板の id を返す
 * （ほかの人が先に報告していれば、渡した数より少なくなる）。上限は DB でも確かめる。
 */
export async function reserveStickers(
  client: Client,
  boardIds: readonly string[],
): Promise<ActionResult<string[]>> {
  if (new Set(boardIds).size > BULK_RESERVE_MAX) {
    return { ok: false, error: toUserMessage({ message: "too_many_boards" }) };
  }
  const { data, error } = await client.rpc("reserve_stickers", { p_board_ids: [...boardIds] });
  if (error || !data) return { ok: false, error: toUserMessage(error) };
  return { ok: true, data };
}

/** 自分のシールの予約を全部、未に戻す。戻した掲示板の id を返す */
export async function releaseMyStickerReservations(
  client: Client,
): Promise<ActionResult<string[]>> {
  const { data, error } = await client.rpc("release_my_sticker_reservations");
  if (error || !data) return { ok: false, error: toUserMessage(error) };
  return { ok: true, data };
}

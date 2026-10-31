// Derived from action-board (AGPL-3.0). See NOTICE.md. Modified 2026-10.
// Next.js に依存しない。クライアントを引数で受け取り、統合テストから直接呼ぶ。
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { fetchAllBoards, fetchAllPages } from "./boards-query";
import { toUserMessage } from "./errors";
import { normalizeJoinCode } from "./invite-code";
import {
  BULK_RESERVE_MAX,
  DISPLAY_NAME_MAX_LENGTH,
  HISTORY_LIMIT,
  NOTE_MAX_LENGTH,
} from "./limits";
import { isBoardStatus } from "./status";
import type { ActionResult, HistoryItem, MapBoard } from "./types";

type Client = SupabaseClient<Database>;

export type Viewer =
  | { kind: "public" }
  | { kind: "volunteer"; displayName: string }
  | { kind: "revoked" };

async function currentUserId(client: Client): Promise<string | null> {
  const { data } = await client.auth.getClaims();
  return data?.claims.sub ?? null;
}

/**
 * 参加用。getClaims は JWT をローカルで検証するだけなので、運営がユーザーを消した後も
 * 古い Cookie の sub を返してしまう。getUser でサーバーに問い合わせ、実在しなければ
 * 古いセッションを捨てる（参加はまれな操作なので、問い合わせが 1 回増えてもよい）。
 */
async function hasLiveUser(client: Client): Promise<boolean> {
  if (!(await currentUserId(client))) return false;
  const { data, error } = await client.auth.getUser();
  if (!error && data.user) return true;
  await client.auth.signOut({ scope: "local" });
  return false;
}

export async function getViewer(client: Client): Promise<Viewer> {
  const userId = await currentUserId(client);
  if (!userId) return { kind: "public" };
  const { data, error } = await client
    .from("volunteers")
    .select("display_name,revoked_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return { kind: "public" };
  if (data.revoked_at) return { kind: "revoked" };
  return { kind: "volunteer", displayName: data.display_name };
}

export async function joinAsVolunteer(
  client: Client,
  code: string,
  displayName: string,
): Promise<ActionResult<{ displayName: string }>> {
  const name = displayName.trim();
  if (name.length < 1 || name.length > DISPLAY_NAME_MAX_LENGTH) {
    return { ok: false, error: toUserMessage({ message: "invalid_display_name" }) };
  }
  // 全角で打たれた記号・英数字は半角に、ダッシュに見える文字は「-」に揃え、前後の空白は落とす
  const normalizedCode = normalizeJoinCode(code);
  if (!normalizedCode) {
    return { ok: false, error: toUserMessage({ message: "invalid_invite_code" }) };
  }
  if (!(await hasLiveUser(client))) {
    const { error } = await client.auth.signInAnonymously();
    if (error) return { ok: false, error: toUserMessage(error) };
  }
  const { data, error } = await client.rpc("register_volunteer", {
    p_code: normalizedCode,
    p_display_name: name,
  });
  if (error || !data) return { ok: false, error: toUserMessage(error) };
  // 参加コードの誤りは、失敗の記録を残すため例外ではなく error で返ってくる
  if (data.error || !data.display_name) {
    return { ok: false, error: toUserMessage({ message: data.error }) };
  }
  return { ok: true, data: { displayName: data.display_name } };
}

/** ボランティア用。RLS により公開期間外でも読める */
export async function loadBoardsForVolunteer(client: Client): Promise<ActionResult<MapBoard[]>> {
  try {
    return { ok: true, data: await fetchAllBoards(client) };
  } catch (e) {
    console.error("loadBoardsForVolunteer failed", e);
    return { ok: false, error: toUserMessage(null) };
  }
}

export async function loadHistory(
  client: Client,
  boardId: string,
): Promise<ActionResult<HistoryItem[]>> {
  const { data, error } = await client
    .from("poster_board_status_history")
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

export async function updateStatus(
  client: Client,
  input: { boardId: string; status: unknown; note: string },
): Promise<ActionResult<MapBoard>> {
  if (!isBoardStatus(input.status)) {
    return { ok: false, error: toUserMessage(null) };
  }
  // DB でも取り除くが、上限の判定と同じ trim をここで済ませてから渡す
  const note = input.note.trim();
  if (note.length > NOTE_MAX_LENGTH) {
    return { ok: false, error: toUserMessage({ message: "note_too_long" }) };
  }
  const { data, error } = await client.rpc("update_board_status", {
    p_board_id: input.boardId,
    p_status: input.status,
    p_note: note,
  });
  if (error || !data) return { ok: false, error: toUserMessage(error) };
  return { ok: true, data: toMapBoard(data) };
}

type BoardRow = Database["public"]["Tables"]["poster_boards"]["Row"];

function toMapBoard({ id, number, name, address, ward, lat, long, status }: BoardRow): MapBoard {
  return { id, number, name, address, ward, lat, long, status };
}

/**
 * 渡した掲示板のうち、未貼付のものだけをまとめて予約にする。予約にできた掲示板を返す
 * （ほかの人が先に報告していれば、渡した数より少なくなる）。上限は DB でも確かめる。
 */
export async function reserveBoards(
  client: Client,
  boardIds: readonly string[],
): Promise<ActionResult<MapBoard[]>> {
  if (new Set(boardIds).size > BULK_RESERVE_MAX) {
    return { ok: false, error: toUserMessage({ message: "too_many_boards" }) };
  }
  const { data, error } = await client.rpc("reserve_boards", { p_board_ids: [...boardIds] });
  if (error || !data) return { ok: false, error: toUserMessage(error) };
  return { ok: true, data: data.map(toMapBoard) };
}

/** 自分の予約を全部、未貼付に戻す。戻した掲示板を返す */
export async function releaseMyReservations(client: Client): Promise<ActionResult<MapBoard[]>> {
  const { data, error } = await client.rpc("release_my_reservations");
  if (error || !data) return { ok: false, error: toUserMessage(error) };
  return { ok: true, data: data.map(toMapBoard) };
}

/** 自分の予約（いま予約のままで、最後に予約にしたのが自分）。まとめて戻すボタンの件数に使う */
export async function loadMyReservedBoardIds(client: Client): Promise<ActionResult<string[]>> {
  if (!(await currentUserId(client))) return { ok: true, data: [] };
  const { data, error } = await client.rpc("my_reserved_board_ids");
  if (error || !data) return { ok: false, error: toUserMessage(error) };
  return { ok: true, data };
}

/** 「自分が更新したもののみ」フィルター用 */
export async function loadMyBoardIds(client: Client): Promise<ActionResult<string[]>> {
  const userId = await currentUserId(client);
  if (!userId) return { ok: true, data: [] };
  try {
    const rows = await fetchAllPages<{ board_id: string }>((from, to) =>
      client
        .from("poster_board_status_history")
        .select("board_id")
        .eq("user_id", userId)
        .order("id")
        .range(from, to),
    );
    return { ok: true, data: [...new Set(rows.map((row) => row.board_id))] };
  } catch (e) {
    console.error("loadMyBoardIds failed", e);
    return { ok: false, error: toUserMessage(null) };
  }
}

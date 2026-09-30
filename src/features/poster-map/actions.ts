"use server";
// Derived from action-board (AGPL-3.0). See NOTICE.md. Modified 2026-10.
// 認可は DB（RLS・security definer の RPC）で行う。ここはセッション付きクライアントを渡すだけ。
import { createClient } from "@/lib/supabase/server";
import type { ActionResult, HistoryItem, MapBoard } from "./types";
import * as service from "./volunteer-service";

export async function getViewerAction(): Promise<service.Viewer> {
  return service.getViewer(await createClient());
}

export async function joinAction(
  code: string,
  displayName: string,
): Promise<ActionResult<{ displayName: string }>> {
  return service.joinAsVolunteer(await createClient(), code, displayName);
}

export async function loadVolunteerBoardsAction(): Promise<ActionResult<MapBoard[]>> {
  return service.loadBoardsForVolunteer(await createClient());
}

export async function loadHistoryAction(boardId: string): Promise<ActionResult<HistoryItem[]>> {
  return service.loadHistory(await createClient(), boardId);
}

export async function updateStatusAction(input: {
  boardId: string;
  status: string;
  note: string;
}): Promise<ActionResult<MapBoard>> {
  return service.updateStatus(await createClient(), input);
}

export async function loadMyBoardIdsAction(): Promise<ActionResult<string[]>> {
  return service.loadMyBoardIds(await createClient());
}

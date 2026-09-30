"use server";
// Derived from action-board (AGPL-3.0). See NOTICE.md. Modified 2026-10.
// 認可は DB（RLS・security definer の RPC）で行う。ここはセッション付きクライアントを渡すだけ。
// Server Action はブラウザから任意の値で呼べるので、入口で引数の型を確かめる。
import { createClient } from "@/lib/supabase/server";
import { toUserMessage } from "./errors";
import type { ActionResult, HistoryItem, MapBoard } from "./types";
import * as service from "./volunteer-service";

function invalidInput(): { ok: false; error: string } {
  return { ok: false, error: toUserMessage(null) };
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

export async function joinAction(
  code: string,
  displayName: string,
): Promise<ActionResult<{ displayName: string }>> {
  if (!isString(code) || !isString(displayName)) return invalidInput();
  return service.joinAsVolunteer(await createClient(), code, displayName);
}

export async function loadVolunteerBoardsAction(): Promise<ActionResult<MapBoard[]>> {
  return service.loadBoardsForVolunteer(await createClient());
}

export async function loadHistoryAction(boardId: string): Promise<ActionResult<HistoryItem[]>> {
  if (!isString(boardId)) return invalidInput();
  return service.loadHistory(await createClient(), boardId);
}

export async function updateStatusAction(input: {
  boardId: string;
  status: string;
  note: string;
}): Promise<ActionResult<MapBoard>> {
  if (typeof input !== "object" || input === null) return invalidInput();
  const { boardId, status, note } = input;
  if (!isString(boardId) || !isString(status) || !isString(note)) return invalidInput();
  return service.updateStatus(await createClient(), { boardId, status, note });
}

export async function loadMyBoardIdsAction(): Promise<ActionResult<string[]>> {
  return service.loadMyBoardIds(await createClient());
}

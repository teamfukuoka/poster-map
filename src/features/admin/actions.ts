"use server";
// 認可は DB（security definer の RPC）で行う。ここはセッション付きクライアントを渡すだけ。
// Server Action はブラウザから任意の値で呼べるので、入口で引数の型を確かめる。
import { revalidatePath, updateTag } from "next/cache";
import { FALLBACK_MESSAGE } from "@/features/poster-map/errors";
import type { ActionResult } from "@/features/poster-map/types";
import { PUBLIC_WINDOW_TAG } from "@/lib/public-window";
import { SITE_NAME_TAG } from "@/lib/site-name";
import { createClient } from "@/lib/supabase/server";
import * as service from "./admin-service";
import { parseRanges } from "./coverage-view";
import type { AdminRole, CoverageRange, RevealedInviteCode } from "./types";

function invalidInput(): { ok: false; error: string } {
  return { ok: false, error: FALLBACK_MESSAGE };
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function isRole(value: unknown): value is AdminRole {
  return value === "admin" || value === "operator";
}

/** 成功したときだけ、管理画面のデータを取り直させる */
function refreshOnSuccess<T>(result: ActionResult<T>): ActionResult<T> {
  if (result.ok) revalidatePath("/admin", "layout");
  return result;
}

/**
 * 公開の状態・サイト名が変わったとき。管理画面に加えて、公開の画面（ヘッダーのサイト名・期間外の案内を含む）も取り直させる。
 * updateTag は Server Action 用で、次のリクエストを待たせて新しい値を読ませる（古い値を30秒返さない）
 */
function refreshSiteOnSuccess<T>(result: ActionResult<T>): ActionResult<T> {
  if (result.ok) {
    updateTag(SITE_NAME_TAG);
    updateTag(PUBLIC_WINDOW_TAG);
    revalidatePath("/", "layout");
  }
  return result;
}

/** 表示は記録を残すだけで画面の表示は変わらないので、revalidate しない */
export async function revealInviteCodeAction(
  id: string,
): Promise<ActionResult<RevealedInviteCode>> {
  if (!isString(id)) return invalidInput();
  return service.revealInviteCode(await createClient(), id);
}

export async function registerInviteCodeAction(
  label: string,
  code: string,
): Promise<ActionResult<null>> {
  if (!isString(label) || !isString(code)) return invalidInput();
  return refreshOnSuccess(await service.registerInviteCode(await createClient(), label, code));
}

export async function revokeInviteCodeAction(
  id: string,
  revokeVolunteers: boolean,
): Promise<ActionResult<{ revokedVolunteers: number }>> {
  if (!isString(id) || !isBoolean(revokeVolunteers)) return invalidInput();
  return refreshOnSuccess(
    await service.revokeInviteCode(await createClient(), id, revokeVolunteers),
  );
}

export async function setForceHiddenAction(hidden: boolean): Promise<ActionResult<null>> {
  if (!isBoolean(hidden)) return invalidInput();
  return refreshSiteOnSuccess(await service.setForceHidden(await createClient(), hidden));
}

export async function publishSiteAction(confirm: string): Promise<ActionResult<null>> {
  if (!isString(confirm)) return invalidInput();
  return refreshSiteOnSuccess(await service.publishSite(await createClient(), confirm));
}

export async function revertAcceptanceAction(confirm: string): Promise<ActionResult<null>> {
  if (!isString(confirm)) return invalidInput();
  return refreshSiteOnSuccess(await service.revertAcceptance(await createClient(), confirm));
}

export async function resetRehearsalAction(confirm: string): Promise<ActionResult<null>> {
  if (!isString(confirm)) return invalidInput();
  return refreshOnSuccess(await service.resetRehearsal(await createClient(), confirm));
}

export async function createCoverageAssigneeAction(
  label: string,
  note: string,
  ranges: CoverageRange[],
): Promise<ActionResult<null>> {
  const parsed = parseRanges(ranges);
  if (!isString(label) || !isString(note) || !parsed) return invalidInput();
  return refreshOnSuccess(
    await service.createCoverageAssignee(await createClient(), { label, note, ranges: parsed }),
  );
}

export async function updateCoverageAssigneeAction(
  id: string,
  expectedUpdatedAt: string,
  label: string,
  note: string,
  ranges: CoverageRange[],
): Promise<ActionResult<null>> {
  const parsed = parseRanges(ranges);
  if (
    !isString(id) ||
    !isString(expectedUpdatedAt) ||
    !isString(label) ||
    !isString(note) ||
    !parsed
  ) {
    return invalidInput();
  }
  return refreshOnSuccess(
    await service.updateCoverageAssignee(await createClient(), id, expectedUpdatedAt, {
      label,
      note,
      ranges: parsed,
    }),
  );
}

export async function deleteCoverageAssigneeAction(
  id: string,
  expectedUpdatedAt: string,
): Promise<ActionResult<null>> {
  if (!isString(id) || !isString(expectedUpdatedAt)) return invalidInput();
  return refreshOnSuccess(
    await service.deleteCoverageAssignee(await createClient(), id, expectedUpdatedAt),
  );
}

export async function addMemberAction(email: string, role: AdminRole): Promise<ActionResult<null>> {
  if (!isString(email) || !isRole(role)) return invalidInput();
  return refreshOnSuccess(await service.addMember(await createClient(), email, role));
}

export async function removeMemberAction(email: string): Promise<ActionResult<null>> {
  if (!isString(email)) return invalidInput();
  return refreshOnSuccess(await service.removeMember(await createClient(), email));
}

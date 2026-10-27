// Next.js に依存しない。クライアントを引数で受け取り、統合テストから直接呼ぶ。
// 認可は DB（security definer の RPC）で行う。ここは入力を先に確かめ、エラーを文言にする。
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ActionResult } from "@/features/poster-map/types";
import type { Database } from "@/lib/supabase/database.types";
import { parseRanges } from "./coverage-view";
import { toAdminMessage } from "./errors";
import { fetchAllRows } from "./paging";
import type {
  AdminRole,
  AssigneeInput,
  AuditLogRow,
  Coverage,
  CoverageBoard,
  CoverageSummaryRow,
  Dashboard,
  InviteCodeRow,
  RevealedInviteCode,
  SiteState,
} from "./types";
import { normalizeInviteCode, validateInviteCode, validateLabel } from "./validation";

type Client = SupabaseClient<Database>;

function failure(error: { code?: string | null; message?: string | null } | null | undefined) {
  return { ok: false as const, error: toAdminMessage(error) };
}

/** 一覧にない人・許可しないログイン方法の人は null。エラーも null 扱い */
export async function getAdminRole(client: Client): Promise<AdminRole | null> {
  const { data, error } = await client.rpc("admin_whoami");
  if (error) return null;
  return data === "admin" || data === "operator" ? data : null;
}

/** 公開の画面用。最初の画面（loadDashboard）のほかの表は読まない */
export async function loadSiteState(client: Client): Promise<ActionResult<SiteState>> {
  const { data, error } = await client.rpc("admin_site_state");
  if (error) return failure(error);
  const row = data?.[0];
  if (!row) return failure(null);
  return { ok: true, data: row };
}

export async function loadDashboard(client: Client): Promise<ActionResult<Dashboard>> {
  const [site, stale, dangerous, reports, wards] = await Promise.all([
    client.rpc("admin_site_state"),
    client.rpc("admin_stale_reservations"),
    client.rpc("admin_dangerous_boards"),
    client.rpc("admin_recent_reports"),
    client.rpc("admin_ward_progress"),
  ]);
  const error = site.error ?? stale.error ?? dangerous.error ?? reports.error ?? wards.error;
  if (error) return failure(error);
  const siteRow = site.data?.[0];
  if (!siteRow) return failure(null);
  return {
    ok: true,
    data: {
      site: siteRow,
      stale: stale.data ?? [],
      dangerous: dangerous.data ?? [],
      reports: reports.data ?? [],
      wards: wards.data ?? [],
    },
  };
}

export async function loadInviteCodes(client: Client): Promise<ActionResult<InviteCodeRow[]>> {
  const { data, error } = await client.rpc("admin_list_invite_codes");
  if (error) return failure(error);
  return { ok: true, data: data ?? [] };
}

/** 平文を持たない以前のコードは code が null */
export async function revealInviteCode(
  client: Client,
  id: string,
): Promise<ActionResult<RevealedInviteCode>> {
  const { data, error } = await client.rpc("admin_reveal_invite_code", { p_id: id });
  if (error) return failure(error);
  const code: string | null = data ?? null;
  return { ok: true, data: { code } };
}

export async function registerInviteCode(
  client: Client,
  label: string,
  code: string,
): Promise<ActionResult<null>> {
  const normalized = normalizeInviteCode(code);
  const trimmedLabel = label.trim();
  // DB でも同じ判定をするが、断れるものは RPC の前に断る（記録も増えない）
  const message = validateInviteCode(normalized) ?? validateLabel(trimmedLabel);
  if (message) return { ok: false, error: message };
  const { error } = await client.rpc("admin_register_invite_code", {
    p_label: trimmedLabel,
    p_code: normalized,
  });
  if (error) return failure(error);
  return { ok: true, data: null };
}

export async function revokeInviteCode(
  client: Client,
  id: string,
  revokeVolunteers: boolean,
): Promise<ActionResult<{ revokedVolunteers: number }>> {
  const { data, error } = await client.rpc("admin_revoke_invite_code", {
    p_id: id,
    p_revoke_volunteers: revokeVolunteers,
  });
  if (error) return failure(error);
  return { ok: true, data: { revokedVolunteers: data ?? 0 } };
}

export async function setForceHidden(client: Client, hidden: boolean): Promise<ActionResult<null>> {
  const { error } = await client.rpc("admin_set_force_hidden", { p_hidden: hidden });
  if (error) return failure(error);
  return { ok: true, data: null };
}

/** 受理を確かめたうえで公開し、サイト名を受理後の名前にする（確認の文字は「公開する」） */
export async function publishSite(client: Client, confirm: string): Promise<ActionResult<null>> {
  const { error } = await client.rpc("admin_publish", { p_confirm: confirm });
  if (error) return failure(error);
  return { ok: true, data: null };
}

/** 押し間違いの戻し。サイト名を受理前に戻して止める（確認の文字は「受理前に戻す」） */
export async function revertAcceptance(
  client: Client,
  confirm: string,
): Promise<ActionResult<null>> {
  const { error } = await client.rpc("admin_revert_acceptance", { p_confirm: confirm });
  if (error) return failure(error);
  return { ok: true, data: null };
}

export async function resetRehearsal(client: Client, confirm: string): Promise<ActionResult<null>> {
  const { error } = await client.rpc("admin_reset_rehearsal", { p_confirm: confirm });
  if (error) return failure(error);
  return { ok: true, data: null };
}

export async function loadAuditLog(client: Client): Promise<ActionResult<AuditLogRow[]>> {
  const { data, error } = await client.rpc("admin_recent_audit_log");
  if (error) return failure(error);
  return { ok: true, data: data ?? [] };
}

/**
 * 区・校区・町名ごとの数、掲示場ごとの判定、担当者の 3 つ。どれかが失敗したら全体を失敗にする。
 * どれも 1,000 行（max_rows）を超えるので、range でページを分けて全部取る
 */
export async function loadCoverage(client: Client): Promise<ActionResult<Coverage>> {
  const [summary, boards, assignees] = await Promise.all([
    fetchAllRows((from, to) => client.rpc("admin_coverage_summary").range(from, to)),
    fetchAllRows((from, to) => client.rpc("admin_coverage_boards").range(from, to)),
    fetchAllRows((from, to) => client.rpc("admin_coverage_assignees").range(from, to)),
  ]);
  const error = summary.error ?? boards.error ?? assignees.error;
  if (error) return failure(error);
  const rows = [];
  for (const row of assignees.data ?? []) {
    const ranges = parseRanges(row.ranges);
    if (!ranges) return failure(null);
    // updated_at は文字列のまま返す（Date にしない。更新・削除の比較にそのまま使う）
    rows.push({ ...row, ranges });
  }
  return {
    ok: true,
    data: {
      // 型の絞り込み（unit・coverage）は DB の check と RPC の case が保証する
      summary: (summary.data ?? []) as CoverageSummaryRow[],
      boards: (boards.data ?? []) as CoverageBoard[],
      assignees: rows,
    },
  };
}

export async function createCoverageAssignee(
  client: Client,
  input: AssigneeInput,
): Promise<ActionResult<null>> {
  const { error } = await client.rpc("admin_create_coverage_assignee", {
    p_label: input.label,
    p_note: input.note,
    p_ranges: input.ranges,
  });
  if (error) return failure(error);
  return { ok: true, data: null };
}

/** expectedUpdatedAt は loadCoverage で受け取った文字列をそのまま渡す（食い違えば stale_assignee） */
export async function updateCoverageAssignee(
  client: Client,
  id: string,
  expectedUpdatedAt: string,
  input: AssigneeInput,
): Promise<ActionResult<null>> {
  const { error } = await client.rpc("admin_update_coverage_assignee", {
    p_id: id,
    p_expected_updated_at: expectedUpdatedAt,
    p_label: input.label,
    p_note: input.note,
    p_ranges: input.ranges,
  });
  if (error) return failure(error);
  return { ok: true, data: null };
}

export async function deleteCoverageAssignee(
  client: Client,
  id: string,
  expectedUpdatedAt: string,
): Promise<ActionResult<null>> {
  const { error } = await client.rpc("admin_delete_coverage_assignee", {
    p_id: id,
    p_expected_updated_at: expectedUpdatedAt,
  });
  if (error) return failure(error);
  return { ok: true, data: null };
}

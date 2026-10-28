import type { Database } from "@/lib/supabase/database.types";

type Functions = Database["public"]["Functions"];
type Row<Name extends keyof Functions> = Functions[Name]["Returns"] extends (infer R)[] ? R : never;

export type AdminRole = "admin" | "operator";

/** accepted_at: 受理前（「公開する」を押す前）は null */
export type SiteState = Omit<Row<"admin_site_state">, "accepted_at"> & {
  accepted_at: string | null;
};
export type WardProgress = Row<"admin_ward_progress">;

// 生成された型は null にならないと見ているが、実際は null がありうる列を上書きする
/** reserved_by: 予約の履歴がない掲示場は null（履歴を left join するため） */
export type StaleReservation = Omit<Row<"admin_stale_reservations">, "reserved_by"> & {
  reserved_by: string | null;
};
/** reported_at / reported_by / note: 履歴のない掲示場、連絡事項のない報告は null */
export type DangerousBoard = Omit<
  Row<"admin_dangerous_boards">,
  "reported_at" | "reported_by" | "note"
> & {
  reported_at: string | null;
  reported_by: string | null;
  note: string | null;
};
/** note: 連絡事項のない報告（他候補・その他）は null */
export type RecentReport = Omit<Row<"admin_recent_reports">, "note"> & { note: string | null };

/** revoked_at: 失効していなければ null */
export type InviteCodeRow = Omit<Row<"admin_list_invite_codes">, "revoked_at"> & {
  revoked_at: string | null;
};
/** target: 対象のない操作は null */
export type AuditLogRow = Omit<Row<"admin_recent_audit_log">, "target"> & {
  target: string | null;
};

/** 管理メンバー。last_sign_in_at: まだ一度もログインしていなければ null */
export type MemberRow = Omit<Row<"admin_list_members">, "role" | "last_sign_in_at"> & {
  role: AdminRole;
  last_sign_in_at: string | null;
};

/** admin_reveal_invite_code は、平文を持たない以前のコードでは null を返す */
export type RevealedInviteCode = { code: string | null };

export type Dashboard = {
  site: SiteState;
  stale: StaleReservation[];
  dangerous: DangerousBoard[];
  reports: RecentReport[];
  wards: WardProgress[];
};

// ---- カバー地域 ----------------------------------------------------------

export type CoverageKind = "ward" | "school" | "town" | "chome";
/** kind ごとに使う項目だけが入り、ほかは null（ward: ward / school: school / town: ward・town / chome: ward・town・chome） */
export type CoverageRange = {
  kind: CoverageKind;
  ward: string | null;
  school: string | null;
  town: string | null;
  chome: string | null;
};
export type CoverageStatus = "assigned" | "reserved" | "none";

/**
 * ward / school / town / chome: 生成された型は null にならないと見ているが、
 * 校区・町名の表にない掲示場の行、その単位で使わない項目は null
 * （none: 担当のつかない掲示場の数。予約・完了は reserved）
 */
export type CoverageSummaryRow = Omit<
  Row<"admin_coverage_summary">,
  "unit" | "ward" | "school" | "town" | "chome"
> & {
  unit: CoverageKind;
  ward: string | null;
  school: string | null;
  town: string | null;
  chome: string | null;
};

/** school / school_source / town / chome: 校区・町名の表にない掲示場は null */
export type CoverageBoard = Omit<
  Row<"admin_coverage_boards">,
  "coverage" | "school" | "school_source" | "town" | "chome"
> & {
  coverage: CoverageStatus;
  school: string | null;
  school_source: string | null;
  town: string | null;
  chome: string | null;
};

/** updated_at は文字列のまま画面と Server Action を往復させる（Date にしない。DB はマイクロ秒で比べる） */
export type CoverageAssignee = Omit<Row<"admin_coverage_assignees">, "ranges"> & {
  ranges: CoverageRange[];
};

export type Coverage = {
  summary: CoverageSummaryRow[];
  boards: CoverageBoard[];
  assignees: CoverageAssignee[];
};

export type AssigneeInput = { label: string; note: string; ranges: CoverageRange[] };

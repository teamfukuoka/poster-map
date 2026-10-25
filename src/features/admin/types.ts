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

/** admin_reveal_invite_code は、平文を持たない以前のコードでは null を返す */
export type RevealedInviteCode = { code: string | null };

export type Dashboard = {
  site: SiteState;
  stale: StaleReservation[];
  dangerous: DangerousBoard[];
  reports: RecentReport[];
  wards: WardProgress[];
};

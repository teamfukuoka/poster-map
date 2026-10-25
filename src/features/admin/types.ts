import type { Database } from "@/lib/supabase/database.types";

type Functions = Database["public"]["Functions"];
type Row<Name extends keyof Functions> = Functions[Name]["Returns"] extends (infer R)[] ? R : never;

export type AdminRole = "admin" | "operator";

export type SiteState = Row<"admin_site_state">;
export type StaleReservation = Row<"admin_stale_reservations">;
export type DangerousBoard = Row<"admin_dangerous_boards">;
export type RecentReport = Row<"admin_recent_reports">;
export type WardProgress = Row<"admin_ward_progress">;

// 生成された型は null にならないと見ているが、実際は null がありうる列を上書きする
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

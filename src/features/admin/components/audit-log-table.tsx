import { auditActionLabel, auditTargetLabel } from "../audit-labels";
import { formatJst, textOrDash } from "../dashboard-view";
import type { AuditLogRow } from "../types";

const TH = "py-1 pr-3 font-normal";
const TD = "py-1 pr-3 align-top";

/** 操作の記録（新しい順・直近100件）。メールアドレスと対象はテキストのまま出す */
export function AuditLogTable({ rows }: { rows: AuditLogRow[] }) {
  return (
    <section className="space-y-2">
      <h2 className="font-bold text-brand-dark">操作の記録</h2>
      <p className="text-muted-foreground text-sm">新しい順に、直近100件を出しています。</p>
      {rows.length === 0 ? (
        <p className="rounded-lg bg-card p-3 text-muted-foreground text-sm shadow-card">
          操作の記録はここに並びます。
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg bg-card p-3 shadow-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground text-xs">
                <th className={TH}>日時</th>
                <th className={TH}>操作した人</th>
                <th className={TH}>操作</th>
                <th className={TH}>対象</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className={`${TD} whitespace-nowrap`}>{formatJst(row.created_at)}</td>
                  <td className={`${TD} break-all`}>{textOrDash(row.actor_email)}</td>
                  <td className={`${TD} whitespace-nowrap`}>{auditActionLabel(row.action)}</td>
                  <td className={`${TD} break-words`}>
                    {auditTargetLabel(row.action, row.target)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

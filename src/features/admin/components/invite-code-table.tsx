"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { FALLBACK_MESSAGE } from "@/features/poster-map/errors";
import { revokeInviteCodeAction } from "../actions";
import { formatJst } from "../dashboard-view";
import type { InviteCodeRow } from "../types";
import { ConfirmDialog } from "./confirm-dialog";
import { InviteCodeReveal } from "./invite-code-reveal";

const TH = "py-1 pr-3 font-normal";
const TD = "py-1 pr-3 align-top";

/**
 * 参加コードの一覧。rows にコードの平文は含まれない（has_code だけ）。
 * 「失効させる」は isAdmin のときだけ描く。DB の RPC も管理者だけを通す。
 */
export function InviteCodeTable({ rows, isAdmin }: { rows: InviteCodeRow[]; isAdmin: boolean }) {
  const [target, setTarget] = useState<InviteCodeRow | null>(null);
  const [alsoVolunteers, setAlsoVolunteers] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openRevoke = (row: InviteCodeRow) => {
    setAlsoVolunteers(false);
    setError(null);
    setTarget(row);
  };

  const revoke = async () => {
    if (!target) return;
    try {
      const result = await revokeInviteCodeAction(target.id, alsoVolunteers);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(`失効させました（止めた人数: ${result.data.revokedVolunteers}）`);
    } catch {
      setError(FALLBACK_MESSAGE);
    }
  };

  return (
    <section className="space-y-2">
      <h2 className="font-bold text-brand-dark">登録されている参加コード</h2>
      <p className="text-muted-foreground text-sm">コードを表示すると、操作の記録に残ります。</p>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      {rows.length === 0 ? (
        <p className="rounded-lg bg-card p-3 text-muted-foreground text-sm shadow-card">
          登録した参加コードがここに並びます。
        </p>
      ) : (
        <div className="relative overflow-x-auto rounded-lg bg-card p-3 shadow-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground text-xs">
                <th className={TH}>配布先の名前</th>
                <th className={TH}>登録日時</th>
                <th className={TH}>状態</th>
                <th className={TH}>参加した人数</th>
                <th className={TH}>コード</th>
                {isAdmin && (
                  <th className={TH}>
                    <span className="sr-only">操作</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const active = row.revoked_at === null;
                return (
                  <tr key={row.id} className="border-t">
                    <td className={`${TD} min-w-32 break-words`}>{row.label}</td>
                    <td className={`${TD} whitespace-nowrap`}>{formatJst(row.created_at)}</td>
                    <td className={`${TD} whitespace-nowrap`}>{active ? "有効" : "失効"}</td>
                    <td className={`${TD} whitespace-nowrap`}>
                      {row.volunteers}人（うち止めていない {row.active_volunteers}人）
                    </td>
                    <td className={`${TD} min-w-48`}>
                      <InviteCodeReveal id={row.id} hasCode={row.has_code} />
                    </td>
                    {isAdmin && (
                      <td className={`${TD} whitespace-nowrap`}>
                        {active && (
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => openRevoke(row)}
                          >
                            失効させる
                          </Button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {isAdmin && (
        <ConfirmDialog
          open={target !== null}
          onOpenChange={(open) => !open && setTarget(null)}
          title="この参加コードを失効させますか"
          description={
            <>
              <p>
                配布先の名前: <span className="font-bold text-foreground">{target?.label}</span>
              </p>
              <p>失効させると、このコードでの新しい参加は止まります。</p>
              <div className="flex items-start gap-2">
                <Checkbox
                  id="revoke-volunteers"
                  checked={alsoVolunteers}
                  onCheckedChange={(checked) => setAlsoVolunteers(checked === true)}
                />
                <div className="space-y-1">
                  <Label htmlFor="revoke-volunteers">このコードで参加した人もまとめて止める</Label>
                  <p className="text-muted-foreground text-xs">
                    コードが外にもれたときはチェックをつけてください。
                  </p>
                </div>
              </div>
            </>
          }
          confirmLabel="失効させる"
          destructive
          onConfirm={revoke}
        />
      )}
    </section>
  );
}

"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FALLBACK_MESSAGE } from "@/features/poster-map/errors";
import { removeMemberAction } from "../actions";
import { formatJst } from "../dashboard-view";
import { ROLE_LABELS } from "../role-labels";
import type { MemberRow } from "../types";
import { ConfirmDialog } from "./confirm-dialog";
import { SectionTitle } from "./help-link";

const TH = "py-1 pr-3 font-normal";
const TD = "py-1 pr-3 align-top";

/** 管理画面に入れる人の一覧。自分の行には「外す」を出さない（DB も自分は外させない） */
export function MemberList({ rows }: { rows: MemberRow[] }) {
  const [target, setTarget] = useState<MemberRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  const openRemove = (row: MemberRow) => {
    setError(null);
    setTarget(row);
  };

  const remove = async () => {
    if (!target) return;
    try {
      const result = await removeMemberAction(target.email);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success("外しました");
    } catch {
      setError(FALLBACK_MESSAGE);
    }
  };

  return (
    <section className="space-y-2">
      <SectionTitle help="members-list">管理画面に入れる人</SectionTitle>
      <p className="text-muted-foreground text-sm">
        いま {rows.length}人です。役割を変えるときは、外してから登録し直してください。
      </p>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <div className="relative overflow-x-auto rounded-lg bg-card p-3 shadow-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground text-xs">
              <th className={TH}>メールアドレス</th>
              <th className={TH}>役割</th>
              <th className={TH}>登録日時</th>
              <th className={TH}>最後のログイン</th>
              <th className={TH}>
                <span className="sr-only">操作</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.email} className="border-t">
                <td className={`${TD} min-w-48 break-all`}>
                  {row.email}
                  {row.is_self && (
                    <span className="ml-2 whitespace-nowrap rounded-full bg-brand-light px-2 py-0.5 text-brand-dark text-xs">
                      あなた
                    </span>
                  )}
                </td>
                <td className={`${TD} whitespace-nowrap`}>{ROLE_LABELS[row.role]}</td>
                <td className={`${TD} whitespace-nowrap`}>{formatJst(row.created_at)}</td>
                <td className={`${TD} whitespace-nowrap`}>
                  {row.last_sign_in_at
                    ? formatJst(row.last_sign_in_at)
                    : "まだログインしていません"}
                </td>
                <td className={`${TD} whitespace-nowrap`}>
                  {!row.is_self && (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      aria-label={`${row.email} を外す`}
                      onClick={() => openRemove(row)}
                    >
                      外す
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ConfirmDialog
        open={target !== null}
        onOpenChange={(open) => !open && setTarget(null)}
        title="この人を管理メンバーから外しますか"
        description={
          <>
            <p>
              メールアドレス:{" "}
              <span className="break-all font-bold text-foreground">{target?.email}</span>
            </p>
            <p>外すと、この人は次の操作から管理画面に入れなくなります。</p>
          </>
        }
        confirmLabel="外す"
        destructive
        onConfirm={remove}
      />
    </section>
  );
}

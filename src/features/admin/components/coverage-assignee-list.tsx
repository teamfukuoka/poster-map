"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FALLBACK_MESSAGE } from "@/features/poster-map/errors";
import { deleteCoverageAssigneeAction } from "../actions";
import { filterAssignees, type Place, rangeKey, rangeLabel } from "../coverage-view";
import type { CoverageAssignee } from "../types";
import { ConfirmDialog } from "./confirm-dialog";
import { CoverageAssigneeForm } from "./coverage-assignee-form";

/** 登録済みの担当者。「直す」はその場でフォームに、「外す」は確かめてから */
export function CoverageAssigneeList({
  assignees,
  places,
}: {
  assignees: CoverageAssignee[];
  places: Place[];
}) {
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [target, setTarget] = useState<CoverageAssignee | null>(null);
  const [error, setError] = useState<string | null>(null);

  const shown = filterAssignees(assignees, query);

  const remove = async () => {
    if (!target) return;
    try {
      // updated_at は読み込んだ文字列のまま渡す
      const result = await deleteCoverageAssigneeAction(target.id, target.updated_at);
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
      <h2 className="font-bold text-brand-dark">登録済みの担当者</h2>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      {assignees.length === 0 ? (
        <p className="rounded-lg bg-card p-3 text-muted-foreground text-sm shadow-card">
          登録した担当者がここに並びます。
        </p>
      ) : (
        <>
          <div className="space-y-1">
            <Label htmlFor="coverage-assignee-search">担当者を探す</Label>
            <Input
              id="coverage-assignee-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
              placeholder="呼び名・地名"
            />
          </div>
          {shown.length === 0 ? (
            <p className="rounded-lg bg-card p-3 text-muted-foreground text-sm shadow-card">
              見つかりませんでした。
            </p>
          ) : (
            <ul className="space-y-2">
              {shown.map((a) => (
                <li key={a.id}>
                  {editingId === a.id ? (
                    <CoverageAssigneeForm
                      places={places}
                      assignees={assignees}
                      initial={a}
                      onDone={() => setEditingId(null)}
                      onCancel={() => setEditingId(null)}
                    />
                  ) : (
                    <div className="space-y-2 rounded-lg bg-card p-3 shadow-card">
                      <div className="flex flex-wrap items-baseline gap-x-3">
                        <span className="font-bold">{a.label}</span>
                        <span className="text-muted-foreground text-sm">{a.board_count}か所</span>
                      </div>
                      <ul className="flex flex-wrap gap-1 text-sm">
                        {a.ranges.map((r) => (
                          <li key={rangeKey(r)} className="rounded-full bg-muted px-2 py-0.5">
                            {rangeLabel(r)}
                          </li>
                        ))}
                      </ul>
                      {a.note !== "" && <p className="text-sm">{a.note}</p>}
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          aria-label={`${a.label}を直す`}
                          onClick={() => {
                            setError(null);
                            setEditingId(a.id);
                          }}
                        >
                          直す
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          aria-label={`${a.label}を外す`}
                          onClick={() => {
                            setError(null);
                            setTarget(a);
                          }}
                        >
                          外す
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      <ConfirmDialog
        open={target !== null}
        onOpenChange={(open) => {
          if (!open) setTarget(null);
        }}
        title={`${target?.label ?? ""}を外しますか`}
        description={
          <p>外すと、この担当者の範囲は担当なしに戻ります。掲示場そのものは消えません。</p>
        }
        confirmLabel="外す"
        destructive
        onConfirm={remove}
      />
    </section>
  );
}

"use client";
// Derived from action-board (AGPL-3.0). See NOTICE.md. Modified 2026-10.
import { ChevronDown, ChevronUp, Filter } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { BOARD_STATUSES, type BoardStatus, STATUS_CONFIG, type StatusGroup } from "../status";
import type { BoardFilterState } from "../use-board-filter";

type Props = {
  filterState: BoardFilterState;
  /** 「自分が更新したものだけ」はボランティアだけに出す */
  canShowMine: boolean;
  onToggleStatus: (status: BoardStatus) => void;
  onToggleShowOnlyMine: () => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
};

const GROUPS: { group: StatusGroup; title: string }[] = [
  { group: "status", title: "状況" },
  { group: "error", title: "エラー" },
  { group: "other", title: "その他" },
];

export function BoardFilter({
  filterState,
  canShowMine,
  onToggleStatus,
  onToggleShowOnlyMine,
  onSelectAll,
  onDeselectAll,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const isFiltered = filterState.statuses.size < BOARD_STATUSES.length || filterState.showOnlyMine;

  return (
    <div className="absolute top-2 right-2 z-[1000] sm:top-4 sm:right-4">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-expanded={isOpen}
        className="ml-auto flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-2 shadow-card hover:bg-brand-light"
      >
        <Filter className="h-3.5 w-3.5" />
        <span className="text-sm">
          <span className="sr-only sm:not-sr-only">フィルター</span>
          {isFiltered && `（${filterState.statuses.size}）`}
        </span>
        {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>

      {isOpen && (
        <div className="mt-1 max-h-[60vh] w-60 overflow-y-auto rounded-lg border border-border bg-background p-3 shadow-card">
          <div className="mb-3 flex gap-2">
            <Button variant="outline" size="sm" onClick={onSelectAll} className="h-7 text-xs">
              全て選択
            </Button>
            <Button variant="outline" size="sm" onClick={onDeselectAll} className="h-7 text-xs">
              全て解除
            </Button>
          </div>

          {canShowMine && (
            <div className="mb-3 flex items-center gap-2 border-border border-b pb-3">
              <Checkbox
                id="filter-mine"
                checked={filterState.showOnlyMine}
                onCheckedChange={onToggleShowOnlyMine}
              />
              <Label htmlFor="filter-mine" className="cursor-pointer text-brand-dark text-xs">
                自分が更新したものだけ
              </Label>
            </div>
          )}

          <div className="space-y-3">
            {GROUPS.map(({ group, title }) => (
              <div key={group}>
                <h3 className="mb-1.5 font-semibold text-ink text-xs">{title}</h3>
                <div className="space-y-1.5">
                  {BOARD_STATUSES.filter((s) => STATUS_CONFIG[s].group === group).map((status) => (
                    <div key={status} className="flex items-center gap-2">
                      <Checkbox
                        id={`filter-${status}`}
                        checked={filterState.statuses.has(status)}
                        onCheckedChange={() => onToggleStatus(status)}
                      />
                      <Label
                        htmlFor={`filter-${status}`}
                        className="flex cursor-pointer items-center gap-2 text-xs"
                      >
                        <span
                          aria-hidden
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: STATUS_CONFIG[status].color }}
                        />
                        {STATUS_CONFIG[status].shortLabel}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

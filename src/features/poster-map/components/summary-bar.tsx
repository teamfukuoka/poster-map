// Derived from action-board (AGPL-3.0). See NOTICE.md. Modified 2026-10.
import { summarize } from "../stats";
import { type BoardStatus, PIE_ORDER, STATUS_CONFIG } from "../status";

export function SummaryBar({ boards }: { boards: readonly { status: BoardStatus }[] }) {
  const { total, counts, donePercent } = summarize(boards);
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3">
      <div className="flex items-baseline gap-4">
        <div className="flex items-baseline gap-1">
          <span data-testid="summary-total" className="font-bold text-2xl">
            {total.toLocaleString("ja-JP")}
          </span>
          <span className="text-muted-foreground text-xs">か所</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span data-testid="summary-done" className="font-bold text-2xl text-green-600">
            {counts.done.toLocaleString("ja-JP")}
          </span>
          <span className="text-muted-foreground text-xs">完了</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span data-testid="summary-percent" className="font-bold text-2xl text-blue-600">
            {donePercent}%
          </span>
          <span className="text-muted-foreground text-xs">完了率</span>
        </div>
      </div>
      <div className="hidden h-6 w-px bg-border sm:block" />
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {PIE_ORDER.map((status) => (
          <span key={status} className="flex items-center gap-1 whitespace-nowrap text-xs">
            <span
              aria-hidden
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: STATUS_CONFIG[status].color }}
            />
            {STATUS_CONFIG[status].shortLabel}
            <span className="font-semibold">{counts[status]}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

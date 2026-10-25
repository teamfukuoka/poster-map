// Derived from action-board (AGPL-3.0). See NOTICE.md. Modified 2026-10.
import { summarize } from "../stats";
import { type BoardStatus, PIE_ORDER, STATUS_CONFIG, statusLabels } from "../status";

type Props = {
  boards: readonly { status: BoardStatus }[];
  isVolunteer: boolean;
};

export function SummaryBar({ boards, isVolunteer }: Props) {
  const { total, counts, donePercent } = summarize(boards);
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg bg-card p-3 shadow-card">
      <div className="flex items-baseline gap-4">
        <div className="flex items-baseline gap-1">
          <span data-testid="summary-total" className="font-bold text-2xl">
            {total.toLocaleString("ja-JP")}
          </span>
          <span className="text-muted-foreground text-xs">か所</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span data-testid="summary-done" className="font-bold text-2xl text-ink">
            {counts.done.toLocaleString("ja-JP")}
          </span>
          <span className="text-muted-foreground text-xs">完了</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span data-testid="summary-percent" className="font-bold text-2xl text-brand-dark">
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
            {statusLabels(status, isVolunteer).shortLabel}
            <span className="font-semibold">{counts[status]}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

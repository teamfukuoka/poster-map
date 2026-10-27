import { formatShare, isRehearsalNotePeriod, totalsOf } from "../coverage-view";
import type { CoverageBoard, CoverageSummaryRow } from "../types";

function Tile({ name, value, alert }: { name: string; value: string; alert?: boolean }) {
  return (
    <div className="rounded-lg bg-card p-3 shadow-card">
      <dt className="text-muted-foreground text-xs">{name}</dt>
      <dd className={`font-bold text-xl ${alert ? "text-destructive" : ""}`}>{value}</dd>
    </div>
  );
}

/** 全体の数。担当なしは赤。リハーサルの期間と、校区・町名の表が古いときの注意も出す */
export function CoverageTotals({
  summary,
  boards,
  now,
}: {
  summary: CoverageSummaryRow[];
  boards: CoverageBoard[];
  now: Date;
}) {
  const totals = totalsOf(summary);
  const missing = boards.filter((b) => b.school_source === null).length;
  return (
    <section className="space-y-2">
      <h2 className="font-bold text-brand-dark">全体の数</h2>
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Tile name="掲示場" value={String(totals.total)} />
        <Tile name="担当あり" value={String(totals.assigned)} />
        <Tile name="予約あり" value={String(totals.reserved)} />
        <Tile name="担当なし" value={String(totals.none)} alert={totals.none > 0} />
        <Tile
          name="カバー率"
          value={formatShare(totals.assigned + totals.reserved, totals.total)}
        />
      </dl>
      {isRehearsalNotePeriod(now) && (
        <p className="text-muted-foreground text-xs">
          10/31 までの予約・貼ったはリハーサルの報告です
        </p>
      )}
      {missing > 0 && (
        <p role="alert" className="text-destructive text-sm">
          校区・町名が入っていない掲示場が {missing}{" "}
          か所あります。掲示場の取り込みをやり直してください。
        </p>
      )}
    </section>
  );
}

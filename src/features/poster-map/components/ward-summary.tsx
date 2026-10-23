import { summarizeByWard } from "../stats";
import type { BoardStatus } from "../status";

export function WardSummary({
  boards,
}: {
  boards: readonly { ward: string; status: BoardStatus }[];
}) {
  const rows = summarizeByWard(boards);
  return (
    <div className="overflow-x-auto rounded-lg bg-card p-3 shadow-card">
      <h2 className="mb-2 font-bold text-brand-dark text-sm">区ごとの状況</h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-muted-foreground text-xs">
            <th className="py-1 font-normal">区</th>
            <th className="py-1 text-right font-normal">か所</th>
            <th className="py-1 text-right font-normal">完了</th>
            <th className="py-1 text-right font-normal">完了率</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ ward, summary }) => (
            <tr key={ward} className="border-t">
              <td className="py-1">{ward}</td>
              <td className="py-1 text-right">{summary.total}</td>
              <td className="py-1 text-right">{summary.counts.done}</td>
              <td className="py-1 text-right">{summary.donePercent}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

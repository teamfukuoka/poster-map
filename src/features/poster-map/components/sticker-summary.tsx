// シールの表示での集計バーと区ごとの状況。対象はポスターが完了の掲示板。
import {
  STICKER_DISPLAY_ORDER,
  stickerDisplayConfig,
  summarizeStickers,
  summarizeStickersByWard,
} from "../map-view";
import type { StickerStatus } from "../sticker-status";
import type { MapBoard } from "../types";

type Props = {
  boards: readonly Pick<MapBoard, "id" | "status" | "ward">[];
  stickers: ReadonlyMap<string, StickerStatus>;
};

export function StickerSummaryBar({ boards, stickers }: Props) {
  const { target, counts, donePercent } = summarizeStickers(boards, stickers);
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg bg-card p-3 shadow-card">
      <div className="flex items-baseline gap-4">
        <div className="flex items-baseline gap-1">
          <span data-testid="sticker-target" className="font-bold text-2xl">
            {target.toLocaleString("ja-JP")}
          </span>
          <span className="text-muted-foreground text-xs">か所が対象</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span data-testid="sticker-done" className="font-bold text-2xl text-ink">
            {counts.done.toLocaleString("ja-JP")}
          </span>
          <span className="text-muted-foreground text-xs">シール完了</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span data-testid="sticker-percent" className="font-bold text-2xl text-brand-dark">
            {donePercent}%
          </span>
          <span className="text-muted-foreground text-xs">完了率</span>
        </div>
      </div>
      <div className="hidden h-6 w-px bg-border sm:block" />
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {STICKER_DISPLAY_ORDER.map((display) => {
          const { shortLabel, color } = stickerDisplayConfig(display);
          return (
            <span key={display} className="flex items-center gap-1 whitespace-nowrap text-xs">
              <span
                aria-hidden
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: color }}
              />
              {shortLabel}
              <span className="font-semibold">{counts[display]}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

export function StickerWardSummary({ boards, stickers }: Props) {
  const rows = summarizeStickersByWard(boards, stickers);
  return (
    <div className="overflow-x-auto rounded-lg bg-card p-3 shadow-card">
      <h2 className="mb-2 font-bold text-brand-dark text-sm">区ごとのシールの状況</h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-muted-foreground text-xs">
            <th className="py-1 font-normal">区</th>
            <th className="py-1 text-right font-normal">対象</th>
            <th className="py-1 text-right font-normal">シール完了</th>
            <th className="py-1 text-right font-normal">完了率</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ ward, summary }) => (
            <tr key={ward} className="border-t">
              <td className="py-1">{ward}</td>
              <td className="py-1 text-right">{summary.target}</td>
              <td className="py-1 text-right">{summary.counts.done}</td>
              <td className="py-1 text-right">{summary.donePercent}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

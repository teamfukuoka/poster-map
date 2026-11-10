// 「ポスター｜シール」の切り替え。シールを始めている間だけ、参加中のボランティアに出す。
import type { MapMode } from "../map-view";

const OPTIONS: { mode: MapMode; label: string }[] = [
  { mode: "poster", label: "ポスター" },
  { mode: "sticker", label: "シール" },
];

type Props = {
  mode: MapMode;
  onChange: (mode: MapMode) => void;
};

export function ViewToggle({ mode, onChange }: Props) {
  return (
    <fieldset className="flex items-center gap-2">
      <legend className="sr-only">地図の表示</legend>
      <div className="inline-flex rounded-full border border-border bg-background p-0.5 shadow-card">
        {OPTIONS.map((option) => {
          const isActive = option.mode === mode;
          return (
            <button
              key={option.mode}
              type="button"
              aria-pressed={isActive}
              onClick={() => onChange(option.mode)}
              className={
                isActive
                  ? "min-h-9 rounded-full bg-brand-dark px-4 font-semibold text-sm text-white"
                  : "min-h-9 rounded-full px-4 text-muted-foreground text-sm hover:bg-brand-light"
              }
            >
              {option.label}
            </button>
          );
        })}
      </div>
      <span className="text-muted-foreground text-xs">
        {mode === "sticker" ? "シールの状況を表示中" : "ポスターの状況を表示中"}
      </span>
    </fieldset>
  );
}

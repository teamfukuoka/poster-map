"use client";
// シールの表示でのフィルター。ポスターのフィルター（board-filter.tsx）と同じ見た目。
import { ChevronDown, ChevronUp, Filter } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  STICKER_DISPLAY_ORDER,
  STICKER_DISPLAYS,
  type StickerDisplay,
  stickerDisplayConfig,
} from "../map-view";

type Props = {
  displays: ReadonlySet<StickerDisplay>;
  onChange: (displays: ReadonlySet<StickerDisplay>) => void;
};

export function StickerFilter({ displays, onChange }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const isFiltered = displays.size < STICKER_DISPLAYS.length;

  const toggle = (display: StickerDisplay) => {
    const next = new Set(displays);
    if (next.has(display)) {
      next.delete(display);
    } else {
      next.add(display);
    }
    onChange(next);
  };

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
          {isFiltered && `（${displays.size}）`}
        </span>
        {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>

      {isOpen && (
        <div className="mt-1 max-h-[60vh] w-60 overflow-y-auto rounded-lg border border-border bg-background p-3 shadow-card">
          <div className="mb-3 flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onChange(new Set(STICKER_DISPLAYS))}
              className="h-7 text-xs"
            >
              全て選択
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onChange(new Set())}
              className="h-7 text-xs"
            >
              全て解除
            </Button>
          </div>
          <h3 className="mb-1.5 font-semibold text-ink text-xs">シールの状況</h3>
          <div className="space-y-1.5">
            {STICKER_DISPLAY_ORDER.map((display) => {
              const { shortLabel, color } = stickerDisplayConfig(display);
              return (
                <div key={display} className="flex items-center gap-2">
                  <Checkbox
                    id={`sticker-filter-${display}`}
                    checked={displays.has(display)}
                    onCheckedChange={() => toggle(display)}
                  />
                  <Label
                    htmlFor={`sticker-filter-${display}`}
                    className="flex cursor-pointer items-center gap-2 text-xs"
                  >
                    <span
                      aria-hidden
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    {shortLabel}
                  </Label>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

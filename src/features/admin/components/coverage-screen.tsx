"use client";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { markerStyle } from "../coverage-map-view";
import { buildPlaces } from "../coverage-view";
import type { Coverage, CoverageSummaryRow } from "../types";
import { CoverageAssigneeForm } from "./coverage-assignee-form";
import { CoverageAssigneeList } from "./coverage-assignee-list";
import { CoverageTable, isSameRow } from "./coverage-table";
import { CoverageTotals } from "./coverage-totals";

// leaflet は window を使うので、ブラウザでだけ読み込む
const CoverageMap = dynamic(() => import("./coverage-map"), {
  ssr: false,
  loading: () => <div className="h-[360px] animate-pulse rounded-lg bg-muted md:h-[480px]" />,
});

const LEGEND = [
  { label: "担当なし", color: markerStyle("none").color },
  { label: "予約あり", color: markerStyle("reserved").color },
  { label: "担当あり", color: markerStyle("assigned").color },
];

/** カバー地域の画面。並びは 全体の数 → 一覧 →（地図）→ 登録 → 登録済み */
export function CoverageScreen({ data, now }: { data: Coverage; now: Date }) {
  const [pickedRow, setPickedRow] = useState<CoverageSummaryRow | null>(null);
  const places = useMemo(() => buildPlaces(data.summary), [data.summary]);
  // 登録・外すで集計が読み直されたら、選んだ行も新しい集計の同じ行にそろえる（なければ外す）
  const selected = useMemo(
    () => (pickedRow ? (data.summary.find((r) => isSameRow(r, pickedRow)) ?? null) : null),
    [data.summary, pickedRow],
  );

  return (
    <div className="space-y-6">
      <CoverageTotals summary={data.summary} boards={data.boards} now={now} />
      <CoverageTable
        summary={data.summary}
        boards={data.boards}
        selected={selected}
        onSelect={setPickedRow}
      />
      <section className="space-y-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <h2 className="font-bold text-brand-dark">地図</h2>
          <ul className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
            {LEGEND.map((l) => (
              <li key={l.label} className="flex items-center gap-1">
                <span
                  aria-hidden="true"
                  className="inline-block size-2.5 rounded-full"
                  style={{ backgroundColor: l.color }}
                />
                {l.label}
              </li>
            ))}
          </ul>
        </div>
        <CoverageMap boards={data.boards} selected={selected} />
      </section>
      <section className="space-y-2">
        <h2 className="font-bold text-brand-dark">担当者を登録する</h2>
        <CoverageAssigneeForm places={places} assignees={data.assignees} />
      </section>
      <CoverageAssigneeList assignees={data.assignees} places={places} />
    </div>
  );
}

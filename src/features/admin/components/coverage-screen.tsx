"use client";
import { useMemo, useState } from "react";
import { buildPlaces } from "../coverage-view";
import type { Coverage, CoverageSummaryRow } from "../types";
import { CoverageAssigneeForm } from "./coverage-assignee-form";
import { CoverageAssigneeList } from "./coverage-assignee-list";
import { CoverageTable, isSameRow } from "./coverage-table";
import { CoverageTotals } from "./coverage-totals";

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
      {/* 一覧のすぐ下に地図が入る（selected を使う） */}
      <section className="space-y-2">
        <h2 className="font-bold text-brand-dark">担当者を登録する</h2>
        <CoverageAssigneeForm places={places} assignees={data.assignees} />
      </section>
      <CoverageAssigneeList assignees={data.assignees} places={places} />
    </div>
  );
}

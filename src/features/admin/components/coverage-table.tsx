"use client";
import { Fragment, useEffect, useState } from "react";
import { WARDS } from "@/features/poster-map/area";
import { boardsInRow, chomeRowsOf, filterSummary, formatShare } from "../coverage-view";
import type { CoverageBoard, CoverageKind, CoverageSummaryRow } from "../types";

const TH = "py-1 pr-3 font-normal whitespace-nowrap";
const TD = "py-1 pr-3 align-top";
const NOWRAP = "whitespace-nowrap";

const UNITS: { unit: CoverageKind; label: string }[] = [
  { unit: "ward", label: "区" },
  { unit: "school", label: "校区" },
  { unit: "town", label: "町名" },
];

const COVERAGE_LABELS = { assigned: "担当あり", reserved: "予約あり", none: "担当なし" } as const;
const MAX_ASSIGNEES = 3;

/** 同じ行か（集計は再読み込みで作り直されるので、中身で比べる） */
export function isSameRow(a: CoverageSummaryRow, b: CoverageSummaryRow): boolean {
  return (
    a.unit === b.unit &&
    a.ward === b.ward &&
    a.school === b.school &&
    a.town === b.town &&
    a.chome === b.chome
  );
}

function rowKey(r: CoverageSummaryRow): string {
  return JSON.stringify([r.unit, r.ward, r.school, r.town, r.chome]);
}

/** 行の地名。校区・町名の表にない行は null の代わりの言葉を出す */
export function rowName(r: CoverageSummaryRow): string {
  switch (r.unit) {
    case "ward":
      return r.ward ?? "区なし";
    case "school":
      return r.school ?? "校区なし";
    case "town":
      return r.town ?? "町名なし";
    case "chome":
      return r.chome ?? "丁目なし";
  }
}

function assigneeText(labels: string[]): string {
  if (labels.length === 0) return "—";
  const shown = labels.slice(0, MAX_ASSIGNEES).join("、");
  const rest = labels.length - MAX_ASSIGNEES;
  return rest > 0 ? `${shown} ほか${rest}人` : shown;
}

type Props = {
  summary: CoverageSummaryRow[];
  boards: CoverageBoard[];
  selected: CoverageSummaryRow | null;
  onSelect: (row: CoverageSummaryRow | null) => void;
};

/** 区・校区・町名ごとの一覧。行を押すと、その範囲の掲示場を下に出す */
export function CoverageTable({ summary, boards, selected, onSelect }: Props) {
  const [unit, setUnit] = useState<CoverageKind>("ward");
  const [ward, setWard] = useState<string | null>(null);
  const [onlyGaps, setOnlyGaps] = useState(false);
  const [opened, setOpened] = useState<ReadonlySet<string>>(new Set());

  const rows = filterSummary(summary, { unit, ward, onlyGaps });

  // 選んだ行が一覧から見えなくなったら（単位・絞り込みの切り替え、丁目を閉じる、集計の読み直し）選びを外す
  const visibleChomes = rows.flatMap((r) =>
    r.unit === "town" && r.ward !== null && r.town !== null && opened.has(rowKey(r))
      ? chomeRowsOf(summary, r.ward, r.town)
      : [],
  );
  const isVisible =
    selected === null ||
    rows.some((r) => isSameRow(r, selected)) ||
    visibleChomes.some((r) => isSameRow(r, selected));
  useEffect(() => {
    if (!isVisible) onSelect(null);
  }, [isVisible, onSelect]);

  const toggleOpen = (key: string) => {
    const next = new Set(opened);
    if (!next.delete(key)) next.add(key);
    setOpened(next);
  };

  const renderRow = (r: CoverageSummaryRow, depth: 0 | 1) => {
    const key = rowKey(r);
    const chomes =
      r.unit === "town" && r.ward !== null && r.town !== null
        ? chomeRowsOf(summary, r.ward, r.town)
        : [];
    const isOpen = opened.has(key);
    const isSelected = selected !== null && isSameRow(selected, r);
    const name = rowName(r);
    return (
      <Fragment key={key}>
        <tr className={`border-t ${isSelected ? "bg-brand-light" : ""}`}>
          <td className={`${TD} ${NOWRAP} ${depth === 1 ? "pl-4" : ""}`}>
            <button
              type="button"
              aria-pressed={isSelected}
              onClick={() => onSelect(isSelected ? null : r)}
              className="text-left font-bold underline-offset-2 hover:underline"
            >
              {name}
            </button>
            {r.unit !== "ward" && r.unit !== "chome" && r.ward && (
              <span className="ml-1 text-muted-foreground text-xs">{r.ward}</span>
            )}
            {chomes.length > 0 && (
              <button
                type="button"
                aria-expanded={isOpen}
                aria-label={
                  isOpen ? `${name}の丁目を閉じる` : `${name}の丁目を見る（${chomes.length}）`
                }
                onClick={() => toggleOpen(key)}
                className="ml-2 text-muted-foreground text-xs underline"
              >
                {isOpen ? "丁目を閉じる" : `丁目 ${chomes.length}`}
              </button>
            )}
          </td>
          <td className={`${TD} ${NOWRAP}`}>{r.total}</td>
          <td className={`${TD} ${NOWRAP}`}>{r.assigned}</td>
          <td className={`${TD} ${NOWRAP}`}>{r.reserved}</td>
          <td className={`${TD} ${NOWRAP} ${r.none > 0 ? "font-bold text-destructive" : ""}`}>
            {r.none}
          </td>
          <td className={`${TD} ${NOWRAP}`}>{formatShare(r.assigned + r.reserved, r.total)}</td>
          <td className={TD}>{assigneeText(r.assignee_labels)}</td>
        </tr>
        {isOpen && chomes.map((c) => renderRow(c, 1))}
      </Fragment>
    );
  };

  return (
    <section className="space-y-2">
      <h2 className="font-bold text-brand-dark">地域ごとの数</h2>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <fieldset aria-label="単位" className="m-0 flex min-w-0 gap-1 border-0 p-0">
          {UNITS.map((u) => (
            <button
              key={u.unit}
              type="button"
              aria-pressed={unit === u.unit}
              onClick={() => setUnit(u.unit)}
              className={
                unit === u.unit
                  ? "h-9 rounded-full bg-brand-light px-4 font-bold text-brand-dark text-sm"
                  : "h-9 rounded-full px-4 text-sm hover:bg-muted"
              }
            >
              {u.label}
            </button>
          ))}
        </fieldset>
        <label className="flex items-center gap-2 text-sm">
          区で絞る
          <select
            value={ward ?? ""}
            onChange={(e) => {
              setWard(e.target.value === "" ? null : e.target.value);
            }}
            className="h-9 rounded-lg border border-input bg-background px-2 text-sm"
          >
            <option value="">すべての区</option>
            {WARDS.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={onlyGaps}
            onChange={(e) => setOnlyGaps(e.target.checked)}
            className="size-4"
          />
          担当なしがある所だけ
        </label>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-lg bg-card p-3 text-muted-foreground text-sm shadow-card">
          当てはまる所はありません。
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg bg-card p-3 shadow-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground text-xs">
                <th className={TH}>地名</th>
                <th className={TH}>掲示場</th>
                <th className={TH}>担当あり</th>
                <th className={TH}>予約あり</th>
                <th className={TH}>担当なし</th>
                <th className={TH}>カバー率</th>
                <th className={TH}>いまの担当者</th>
              </tr>
            </thead>
            <tbody>{rows.map((r) => renderRow(r, 0))}</tbody>
          </table>
        </div>
      )}
      {selected && <SelectedBoards row={selected} boards={boardsInRow(boards, selected)} />}
    </section>
  );
}

function SelectedBoards({ row, boards }: { row: CoverageSummaryRow; boards: CoverageBoard[] }) {
  const title = `${rowName(row)}の掲示場`;
  return (
    <section aria-label={title} className="space-y-1 rounded-lg bg-card p-3 shadow-card">
      <h3 className="font-bold text-sm">
        {title}（{boards.length}か所）
      </h3>
      <ul className="max-h-96 divide-y overflow-y-auto text-sm">
        {boards.map((b) => (
          <li key={b.board_id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-1">
            <span className="font-bold">{b.number}</span>
            <span>{b.address}</span>
            <span className={b.coverage === "none" ? "font-bold text-destructive" : ""}>
              {COVERAGE_LABELS[b.coverage]}
            </span>
            <span className="text-muted-foreground">{b.status === "done" ? "貼った" : "まだ"}</span>
            {b.assignee_labels.length > 0 && (
              <span className="text-muted-foreground text-xs">{b.assignee_labels.join("、")}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

"use client";
import { type FormEvent, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { WARDS } from "@/features/poster-map/area";
import { FALLBACK_MESSAGE } from "@/features/poster-map/errors";
import { createCoverageAssigneeAction, updateCoverageAssigneeAction } from "../actions";
import { hasSameLabel, type Place, rangeKey, rangeLabel, searchPlaces } from "../coverage-view";
import type { CoverageAssignee, CoverageKind, CoverageRange } from "../types";

const LABEL_MAX = 30;
const NOTE_MAX = 200;
const LABEL_MESSAGE = `呼び名は1〜${LABEL_MAX}文字で入れてください。`;
const RANGES_MESSAGE = "範囲を1つ以上選んでください。";
const KIND_LABELS: Record<CoverageKind, string> = {
  ward: "区",
  school: "校区",
  town: "町名",
  chome: "丁目",
};

const SELECT_CLASS = "h-9 w-full rounded-lg border border-input bg-background px-2 text-sm";

type Props = {
  places: Place[];
  /** 同じ呼び名の確かめに使う（全員） */
  assignees: CoverageAssignee[];
  /** あれば「直す」。中身入りで開き、保存は updated_at を添えて送る */
  initial?: CoverageAssignee;
  /** 保存できたあとに呼ぶ（直すフォームを閉じるため） */
  onDone?: () => void;
  onCancel?: () => void;
};

/** 担当者の登録と直し。範囲は地名の検索か、区 → 校区・町名の順で選ぶ */
export function CoverageAssigneeForm({ places, assignees, initial, onDone, onCancel }: Props) {
  const id = useId();
  const [label, setLabel] = useState(initial?.label ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [ranges, setRanges] = useState<CoverageRange[]>(initial?.ranges ?? []);
  const [query, setQuery] = useState("");
  const [ward, setWard] = useState("");
  const [pick, setPick] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // state は次の描画まで変わらないので、同じ瞬間の二度押しは ref で止める
  const sending = useRef(false);

  const chosenKeys = new Set(ranges.map(rangeKey));
  const { places: candidates, more } = searchPlaces(places, query);
  const wardPlaces = places.filter(
    (p) =>
      (p.kind === "school" && p.wards.includes(ward)) ||
      (p.kind === "town" && p.range.ward === ward),
  );
  const sameLabel = hasSameLabel(assignees, label, initial?.id);

  const add = (range: CoverageRange) => {
    setRanges((current) =>
      current.some((r) => rangeKey(r) === rangeKey(range)) ? current : [...current, range],
    );
  };
  const remove = (range: CoverageRange) => {
    setRanges((current) => current.filter((r) => rangeKey(r) !== rangeKey(range)));
  };

  const addPicked = () => {
    const place = wardPlaces.find((p) => `${p.kind}:${p.range.school ?? p.range.town}` === pick);
    if (!place) return;
    add(place.range);
    setPick("");
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (sending.current) return;
    const trimmed = label.trim();
    const length = [...trimmed].length;
    if (length < 1 || length > LABEL_MAX) {
      setError(LABEL_MESSAGE);
      return;
    }
    if (ranges.length === 0) {
      setError(RANGES_MESSAGE);
      return;
    }
    setError(null);
    sending.current = true;
    setSaving(true);
    try {
      // updated_at は読み込んだ文字列のまま渡す（Date にしない。DB はマイクロ秒で比べる）
      const result = initial
        ? await updateCoverageAssigneeAction(initial.id, initial.updated_at, trimmed, note, ranges)
        : await createCoverageAssigneeAction(trimmed, note, ranges);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(initial ? "保存しました" : "登録しました");
      if (!initial) {
        setLabel("");
        setNote("");
        setRanges([]);
        setQuery("");
        setWard("");
        setPick("");
      }
      onDone?.();
    } catch {
      // 通信の切断や再デプロイで reject することがある
      setError(FALLBACK_MESSAGE);
    } finally {
      sending.current = false;
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="space-y-4 rounded-lg bg-card p-3 shadow-card"
    >
      <div className="space-y-2">
        <Label htmlFor={`${id}-label`}>呼び名</Label>
        <Input
          id={`${id}-label`}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          maxLength={LABEL_MAX}
          autoComplete="off"
          aria-describedby={`${id}-help`}
        />
        <p id={`${id}-help`} className="text-muted-foreground text-xs">
          本名・電話番号・住所は入れないでください。「A班」「担当1」のような呼び名にします。
        </p>
        {sameLabel && (
          <output className="block text-sm">
            同じ呼び名の担当者がいます。別の人なら、区別できる呼び名にしてください。
          </output>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${id}-note`}>メモ</Label>
        <Textarea
          id={`${id}-note`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={NOTE_MAX}
          rows={2}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${id}-search`}>地名で探す</Label>
        <Input
          id={`${id}-search`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
          placeholder="例: 馬出"
        />
        {candidates.length > 0 && (
          <ul className="max-h-60 divide-y overflow-y-auto rounded-lg border text-sm">
            {candidates.map((p) => {
              const chosen = chosenKeys.has(rangeKey(p.range));
              return (
                <li key={rangeKey(p.range)}>
                  <button
                    type="button"
                    disabled={chosen}
                    onClick={() => add(p.range)}
                    className="flex min-h-11 w-full flex-wrap items-center gap-x-2 px-3 py-1 text-left hover:bg-muted disabled:opacity-50"
                  >
                    <span className="font-bold">{p.label}</span>{" "}
                    <span className="text-muted-foreground">{KIND_LABELS[p.kind]}</span>{" "}
                    <span className="text-muted-foreground">{p.boardCount}か所</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {more > 0 && (
          <p className="text-muted-foreground text-xs">
            ほか {more} 件。もう少し詳しく入れてください
          </p>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-sm">区から選ぶ</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1">
            <Label htmlFor={`${id}-ward`}>区</Label>
            <select
              id={`${id}-ward`}
              value={ward}
              onChange={(e) => {
                setWard(e.target.value);
                setPick("");
              }}
              className={SELECT_CLASS}
            >
              <option value="">区を選ぶ</option>
              {WARDS.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={ward === ""}
            onClick={() => add({ kind: "ward", ward, school: null, town: null, chome: null })}
          >
            区ぜんぶを足す
          </Button>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1">
            <Label htmlFor={`${id}-pick`}>校区・町名</Label>
            <select
              id={`${id}-pick`}
              value={pick}
              disabled={ward === ""}
              onChange={(e) => setPick(e.target.value)}
              className={SELECT_CLASS}
            >
              <option value="">校区・町名を選ぶ</option>
              {wardPlaces.map((p) => {
                const name = p.range.school ?? p.range.town ?? "";
                return (
                  <option key={rangeKey(p.range)} value={`${p.kind}:${name}`}>
                    {name}（{KIND_LABELS[p.kind]}・{p.boardCount}か所）
                  </option>
                );
              })}
            </select>
          </div>
          <Button type="button" variant="outline" disabled={pick === ""} onClick={addPicked}>
            足す
          </Button>
        </div>
      </div>

      {ranges.length > 0 && (
        <div className="space-y-1">
          <p className="text-sm">選んだ範囲</p>
          <ul aria-label="選んだ範囲" className="flex flex-wrap gap-2">
            {ranges.map((r) => (
              <li
                key={rangeKey(r)}
                className="flex items-center gap-1 rounded-full bg-brand-light py-1 pr-1 pl-3 text-brand-dark text-sm"
              >
                <span>{rangeLabel(r)}</span>
                <button
                  type="button"
                  aria-label={`${rangeLabel(r)}を外す`}
                  onClick={() => remove(r)}
                  className="inline-flex size-8 items-center justify-center rounded-full hover:bg-background"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={saving}>
          {initial ? "保存する" : "登録する"}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" disabled={saving} onClick={onCancel}>
            やめる
          </Button>
        )}
      </div>
    </form>
  );
}

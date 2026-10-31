"use client";
// Derived from action-board (AGPL-3.0). See NOTICE.md. Modified 2026-10.
import { Search, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  type DistrictHit,
  normalizeForSearch,
  SEARCH_MIN_QUERY_LENGTH,
  searchBoards,
  searchDistricts,
  splitBoardNumber,
} from "../search";
import type { MapBoard } from "../types";

type Props = {
  boards: readonly MapBoard[];
  onSelect: (board: MapBoard) => void;
  onSelectDistrict: (hit: DistrictHit) => void;
  /** いま表示を絞っている投票区。null なら全部を表示中 */
  district: string | null;
  onClearDistrict: () => void;
  /** 全画面の上の帯に出すときは、見出しと例を省いて詰める */
  compact?: boolean;
};

/** 候補の小さい行。「筥松第二 6番・東区筥松三丁目3番」 */
function boardDetail(board: MapBoard): string {
  const { district, seq } = splitBoardNumber(board.number);
  const number = district ? `${district} ${seq}番` : board.number;
  return `${number}・${board.address}`;
}

export function BoardSearch({
  boards,
  onSelect,
  onSelectDistrict,
  district,
  onClearDistrict,
  compact = false,
}: Props) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputId = useId();
  const hintId = useId();

  const districts = useMemo(() => searchDistricts(boards, query), [boards, query]);
  const results = useMemo(() => searchBoards(boards, query), [boards, query]);
  const showDropdown = isOpen && normalizeForSearch(query).length >= SEARCH_MIN_QUERY_LENGTH;

  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef}>
      <label
        htmlFor={inputId}
        className={compact ? "sr-only" : "mb-1 block font-bold text-ink text-sm"}
      >
        掲示板を探す
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute top-3.5 left-3 h-4 w-4 text-muted-foreground" />
        <Input
          id={inputId}
          type="search"
          enterKeyHint="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="投票区・場所・住所で探す"
          aria-describedby={compact ? undefined : hintId}
          // 16px 未満だと iPhone で入力のたびに拡大される
          className="h-11 rounded-lg bg-background pr-10 pl-9 text-base shadow-card md:text-base [&::-webkit-search-cancel-button]:hidden"
        />
        {query.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setIsOpen(false);
            }}
            className="absolute top-0 right-0 flex h-11 w-11 items-center justify-center text-muted-foreground hover:text-ink"
            aria-label="検索をクリア"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        {showDropdown && (
          <ul className="absolute top-full right-0 left-0 z-[1100] mt-1 max-h-80 overflow-y-auto rounded-lg border border-border bg-background shadow-card">
            {districts.length === 0 && results.length === 0 ? (
              <li className="px-3 py-3 text-muted-foreground text-sm">
                該当する掲示板がありません
              </li>
            ) : (
              <>
                {districts.map((hit) => (
                  <li key={hit.district} className="border-border border-b">
                    <button
                      type="button"
                      onClick={() => {
                        onSelectDistrict(hit);
                        setQuery("");
                        setIsOpen(false);
                      }}
                      className="flex min-h-11 w-full items-center gap-1 px-3 py-2 text-left hover:bg-brand-light"
                    >
                      <span className="font-bold text-ink text-sm">{hit.district}</span>
                      <span className="text-muted-foreground text-xs">
                        （投票区・{hit.count}か所）
                      </span>
                    </button>
                  </li>
                ))}
                {results.map((board) => (
                  <li key={board.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelect(board);
                        setIsOpen(false);
                      }}
                      className="flex min-h-11 w-full flex-col items-start gap-0.5 px-3 py-2 text-left hover:bg-brand-light"
                    >
                      <span className="font-medium text-ink text-sm">{board.name}</span>
                      <span className="text-muted-foreground text-xs">{boardDetail(board)}</span>
                    </button>
                  </li>
                ))}
              </>
            )}
          </ul>
        )}
      </div>
      {!compact && (
        <p id={hintId} className="mt-1 text-muted-foreground text-xs">
          例：馬出第一、香椎浜小学校、筥松
        </p>
      )}
      {district && (
        <button
          type="button"
          onClick={onClearDistrict}
          className="mt-2 inline-flex min-h-9 items-center gap-1 rounded-full border border-brand bg-brand-light px-3 font-bold text-brand-dark text-sm"
          aria-label={`${district}だけの表示をやめて、全部の掲示板を表示する`}
        >
          {district}だけ表示中
          <X className="h-4 w-4" aria-hidden />
        </button>
      )}
    </div>
  );
}

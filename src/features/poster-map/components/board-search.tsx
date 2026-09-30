"use client";
// Derived from action-board (AGPL-3.0). See NOTICE.md. Modified 2026-10.
import { Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { normalizeForSearch, SEARCH_MIN_QUERY_LENGTH, searchBoards } from "../search";
import type { MapBoard } from "../types";

type Props = {
  boards: readonly MapBoard[];
  onSelect: (board: MapBoard) => void;
};

export function BoardSearch({ boards, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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
    <div
      ref={containerRef}
      className="absolute top-2 left-12 z-[1000] w-[calc(100%-8rem)] sm:top-4 sm:left-1/2 sm:w-72 sm:-translate-x-1/2"
    >
      <div className="relative">
        <Search className="absolute top-2.5 left-2 h-4 w-4 text-gray-400" />
        <Input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="番号・名称・住所で検索"
          className="bg-white pr-8 pl-8 shadow-lg"
          aria-label="掲示板を検索"
        />
        {query.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setIsOpen(false);
            }}
            className="absolute top-2.5 right-2 text-gray-400 hover:text-gray-600"
            aria-label="検索をクリア"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {showDropdown && (
        <ul className="mt-1 max-h-72 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          {results.length === 0 ? (
            <li className="px-3 py-2 text-gray-500 text-xs">該当する掲示板がありません</li>
          ) : (
            results.map((board) => (
              <li key={board.id}>
                <button
                  type="button"
                  onClick={() => {
                    onSelect(board);
                    setIsOpen(false);
                  }}
                  className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left hover:bg-gray-100"
                >
                  <span className="font-medium text-gray-900 text-xs">
                    #{board.number} {board.name}
                  </span>
                  <span className="text-gray-500 text-xs">{board.address}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

"use client";
// Derived from action-board (AGPL-3.0). See NOTICE.md. Modified 2026-10.
import { Copy, MapPin } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { mapLinks } from "../links";
import type { MapBoard } from "../types";

async function copy(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label}をコピーしました`);
  } catch {
    toast.error(`${label}をコピーできませんでした`);
  }
}

/** 掲示板の番号・名称・住所と、地図アプリへのリンク */
export function BoardInfo({ board }: { board: MapBoard }) {
  const links = mapLinks(board);
  return (
    <div className="space-y-1 text-muted-foreground text-sm">
      <div className="flex items-center gap-1">
        <span>
          #{board.number} {board.name}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => copy(board.name, "名称")}
          aria-label="名称をコピー"
        >
          <Copy className="h-3 w-3" />
        </Button>
      </div>
      <div className="flex items-center gap-1">
        <span>{board.address}</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => copy(board.address, "住所")}
          aria-label="住所をコピー"
        >
          <Copy className="h-3 w-3" />
        </Button>
      </div>
      <div className="flex items-center gap-3 pt-1">
        <MapPin className="h-4 w-4" />
        <a href={links.google} target="_blank" rel="noopener noreferrer" className="underline">
          Google マップ
        </a>
        <a href={links.apple} target="_blank" rel="noopener noreferrer" className="underline">
          Apple マップ
        </a>
      </div>
    </div>
  );
}

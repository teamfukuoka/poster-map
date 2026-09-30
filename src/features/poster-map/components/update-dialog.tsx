"use client";
// Derived from action-board (AGPL-3.0). See NOTICE.md. Modified 2026-10.
import { type FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { loadHistoryAction, updateStatusAction } from "../actions";
import { NOTE_MAX_LENGTH } from "../limits";
import { type BoardStatus, isBoardStatus, STATUS_CONFIG, STATUS_SELECT_ORDER } from "../status";
import type { HistoryItem, MapBoard } from "../types";
import { BoardInfo } from "./board-info";

type Props = {
  /** 親で key={board.id} を付け、掲示板ごとに状態を作り直す */
  board: MapBoard | null;
  onClose: () => void;
  onUpdated: (board: MapBoard) => void;
};

type HistoryState = { kind: "loading" } | { kind: "ok"; items: HistoryItem[] } | { kind: "error" };

export function UpdateDialog({ board, onClose, onUpdated }: Props) {
  const [status, setStatus] = useState<BoardStatus>(board?.status ?? "not_yet");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [history, setHistory] = useState<HistoryState>({ kind: "loading" });
  const boardId = board?.id;

  useEffect(() => {
    if (!boardId) return;
    let active = true;
    loadHistoryAction(boardId).then((result) => {
      if (active) setHistory(result.ok ? { kind: "ok", items: result.data } : { kind: "error" });
    });
    return () => {
      active = false;
    };
  }, [boardId]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!board) return;
    setIsSubmitting(true);
    setError(null);
    const result = await updateStatusAction({ boardId: board.id, status, note });
    setIsSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast.success("報告しました。ありがとうございます。");
    onUpdated(result.data);
  };

  return (
    <Dialog open={board !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>ポスターの状況を報告</DialogTitle>
            <DialogDescription>現地の状況を選んでください。</DialogDescription>
          </DialogHeader>
          {board && <BoardInfo board={board} />}

          <div className="space-y-2">
            <Label htmlFor="update-status">ポスターの状況</Label>
            <Select value={status} onValueChange={(v) => isBoardStatus(v) && setStatus(v)}>
              <SelectTrigger id="update-status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_SELECT_ORDER.map((s) => (
                  <SelectItem key={s} value={s}>
                    <span
                      aria-hidden
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: STATUS_CONFIG[s].color }}
                    />
                    {STATUS_CONFIG[s].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="update-note">連絡事項（任意）</Label>
            <Textarea
              id="update-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={NOTE_MAX_LENGTH}
              rows={3}
              placeholder="「掲示板が傾いている」「番号札が見当たらない」など、気づいたこと"
            />
            <p className="text-muted-foreground text-xs">
              ほかのボランティアに表示されます。個人が特定できる情報は書かないでください。
            </p>
          </div>

          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}

          <section className="max-h-48 overflow-y-auto border-t pt-3">
            <h3 className="mb-2 font-semibold text-sm">更新履歴</h3>
            {history.kind === "loading" && (
              <p className="text-muted-foreground text-sm">読み込み中…</p>
            )}
            {history.kind === "error" && (
              <p className="text-muted-foreground text-sm">履歴を読み込めませんでした。</p>
            )}
            {history.kind === "ok" && history.items.length === 0 && (
              <p className="text-muted-foreground text-sm">履歴はまだありません</p>
            )}
            {history.kind === "ok" && history.items.length > 0 && (
              <ul className="space-y-2">
                {history.items.map((item) => (
                  <li key={item.id} className="text-sm">
                    <div className="text-muted-foreground">
                      {STATUS_CONFIG[item.previousStatus].shortLabel} →{" "}
                      {STATUS_CONFIG[item.newStatus].shortLabel}
                    </div>
                    <div className="text-muted-foreground text-xs">
                      {new Date(item.createdAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}
                      <span className="ml-2">{item.displayName}</span>
                      {item.note && <span className="ml-2">「{item.note}」</span>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              キャンセル
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "報告中…" : "報告する"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

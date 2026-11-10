"use client";
// シールの報告。ポスターの報告（update-dialog.tsx）と同じ形で、選択肢をシールの 4 つにしたもの。
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
import { loadStickerHistoryAction, updateStickerAction } from "../actions";
import { toUserMessage } from "../errors";
import { NOTE_MAX_LENGTH } from "../limits";
import { STATUS_CONFIG } from "../status";
import type { StickerEntry, StickerHistoryItem } from "../sticker-service";
import {
  canSetSticker,
  isStickerStatus,
  isStickerTarget,
  STICKER_SELECT_ORDER,
  STICKER_STATUS_CONFIG,
  type StickerStatus,
} from "../sticker-status";
import type { MapBoard } from "../types";
import { BoardInfo } from "./board-info";

type Props = {
  /** 親で key={board.id} を付け、掲示板ごとに状態を作り直す */
  board: MapBoard;
  /** いまのシールの状態 */
  sticker: StickerStatus;
  onClose: () => void;
  onUpdated: (entry: StickerEntry) => void;
  /** ポスターの報告に切り替える（剥がれていたポスターを貼り直したときなど） */
  onReportPoster: () => void;
};

type HistoryState =
  | { kind: "loading" }
  | { kind: "ok"; items: StickerHistoryItem[] }
  | { kind: "error" };

export function StickerDialog({ board, sticker, onClose, onUpdated, onReportPoster }: Props) {
  const [status, setStatus] = useState<StickerStatus>(sticker);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [history, setHistory] = useState<HistoryState>({ kind: "loading" });
  const isTarget = isStickerTarget(board.status);

  useEffect(() => {
    let active = true;
    // Server Action は通信の切断や再デプロイで reject することがある
    loadStickerHistoryAction(board.id).then(
      (result) => {
        if (active) setHistory(result.ok ? { kind: "ok", items: result.data } : { kind: "error" });
      },
      () => {
        if (active) setHistory({ kind: "error" });
      },
    );
    return () => {
      active = false;
    };
  }, [board.id]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await updateStickerAction({ boardId: board.id, status, note });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success("報告しました。ありがとうございます。");
      onUpdated(result.data);
    } catch {
      setError(toUserMessage(null));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>シールの状況を報告</DialogTitle>
            <DialogDescription>
              {isTarget
                ? "現地の状況を選んでください。"
                : `この掲示板のポスターは「${STATUS_CONFIG[board.status].shortLabel}」です。シールの予約・完了は、ポスターが完了の掲示板だけで選べます。`}
            </DialogDescription>
          </DialogHeader>
          <BoardInfo board={board} />

          <div className="space-y-2">
            <Label htmlFor="sticker-status">シールの状況</Label>
            <Select value={status} onValueChange={(v) => isStickerStatus(v) && setStatus(v)}>
              <SelectTrigger id="sticker-status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STICKER_SELECT_ORDER.map((s) => (
                  <SelectItem key={s} value={s} disabled={!canSetSticker(s, board.status)}>
                    <span
                      aria-hidden
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: STICKER_STATUS_CONFIG[s].color }}
                    />
                    {STICKER_STATUS_CONFIG[s].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sticker-note">連絡事項（任意）</Label>
            <Textarea
              id="sticker-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={NOTE_MAX_LENGTH}
              rows={3}
              placeholder="「ポスターの右下が破れている」など、気づいたこと"
            />
            <p className="text-muted-foreground text-xs">
              ほかのボランティアに表示されます。個人が特定できる情報は書かないでください。
            </p>
          </div>

          <p className="text-sm">
            ポスターの状況が地図と違うときは、
            <Button
              type="button"
              variant="link"
              className="h-auto p-0 align-baseline text-brand-dark"
              onClick={onReportPoster}
            >
              ポスターの状況を報告
            </Button>
            から直せます。
          </p>

          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}

          <section className="max-h-48 overflow-y-auto border-t pt-3">
            <h3 className="mb-2 font-semibold text-sm">シールの更新履歴</h3>
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
                      {STICKER_STATUS_CONFIG[item.previousStatus].shortLabel} →{" "}
                      {STICKER_STATUS_CONFIG[item.newStatus].shortLabel}
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

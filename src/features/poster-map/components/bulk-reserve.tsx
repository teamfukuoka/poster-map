"use client";
import { useState } from "react";
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
import { releaseMyReservationsAction, reserveBoardsAction } from "../actions";
import { toUserMessage } from "../errors";
import { BULK_RESERVE_MAX } from "../limits";
import { districtOf } from "../search";
import type { MapBoard } from "../types";

type Props = {
  /** 検索の対象と同じ、フィルターに関係なく全部の掲示板 */
  boards: readonly MapBoard[];
  /** いま表示を絞っている投票区 */
  districts: readonly string[];
  /** 自分の予約（最後に予約したのが自分）の掲示板 */
  myReservedIds: ReadonlySet<string>;
  /** まとめて予約した・戻した掲示板 */
  onUpdated: (boards: MapBoard[]) => void;
};

type Pending = "reserve" | "release" | null;

/**
 * 選んでいる投票区の未貼付をまとめて予約する・自分の予約をまとめて未貼付に戻す。
 * 予約は時間がたっても消えないので、2 つをセットで出す。
 */
export function BulkReserve({ boards, districts, myReservedIds, onUpdated }: Props) {
  const [pending, setPending] = useState<Pending>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const names = new Set(districts);
  const targets = boards.filter((b) => b.status === "not_yet" && names.has(districtOf(b) ?? ""));
  const myReserved = boards.filter((b) => b.status === "reserved" && myReservedIds.has(b.id));
  const isTooMany = targets.length > BULK_RESERVE_MAX;
  const districtNames = districts.join("・");

  if (districts.length === 0 && myReserved.length === 0) return null;

  const open = (next: Pending) => {
    setError(null);
    setPending(next);
  };

  const handleConfirm = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      if (pending === "reserve") {
        const result = await reserveBoardsAction(targets.map((b) => b.id));
        if (!result.ok) {
          setError(result.error);
          return;
        }
        const skipped = targets.length - result.data.length;
        toast.success(
          skipped > 0
            ? `${result.data.length}か所を予約しました。${skipped}か所は、ほかの人が先に報告していました。`
            : `${result.data.length}か所を予約しました。`,
        );
        onUpdated(result.data);
      } else {
        const result = await releaseMyReservationsAction();
        if (!result.ok) {
          setError(result.error);
          return;
        }
        toast.success(`${result.data.length}か所を未貼付に戻しました。`);
        onUpdated(result.data);
      }
      setPending(null);
    } catch {
      // Server Action は通信の切断や再デプロイで reject することがある
      setError(toUserMessage(null));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-2">
      {districts.length > 0 &&
        (targets.length === 0 ? (
          <p className="text-muted-foreground text-xs">
            選んでいる投票区に、未貼付の掲示板はありません。
          </p>
        ) : isTooMany ? (
          <p className="text-muted-foreground text-xs">
            選んでいる投票区の未貼付は {targets.length}か所です。まとめて予約できるのは一度に
            {BULK_RESERVE_MAX}か所までなので、投票区を減らしてください。
          </p>
        ) : (
          <Button
            variant="outline"
            className="h-auto min-h-11 w-full whitespace-normal border-brand text-brand-dark"
            onClick={() => open("reserve")}
          >
            選んでいる投票区の未貼付 {targets.length}か所をまとめて予約
          </Button>
        ))}
      {myReserved.length > 0 && (
        <Button
          variant="ghost"
          className="h-auto min-h-11 w-full whitespace-normal text-muted-foreground"
          onClick={() => open("release")}
        >
          自分の予約 {myReserved.length}か所をまとめて未貼付に戻す
        </Button>
      )}

      <Dialog
        open={pending !== null}
        onOpenChange={(next) => !next && !isSubmitting && setPending(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pending === "reserve" ? "まとめて予約" : "まとめて未貼付に戻す"}
            </DialogTitle>
            <DialogDescription>
              {pending === "reserve"
                ? `${districtNames}の未貼付 ${targets.length}か所を予約します。`
                : `自分の予約 ${myReserved.length}か所を未貼付に戻します。`}
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm">
            {pending === "reserve"
              ? "ほかのボランティアの地図にも「予約」と表示され、「ここには私が行きます」と伝わります。その日に回りきれなかった掲示板は、「自分の予約をまとめて未貼付に戻す」で戻してください。"
              : "貼り終えた掲示板があれば、先にピンから「完了」で報告してください。戻すと、ほかのボランティアの地図でも「未貼付」になります。"}
          </p>
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)} disabled={isSubmitting}>
              キャンセル
            </Button>
            <Button onClick={handleConfirm} disabled={isSubmitting}>
              {isSubmitting
                ? "送信中…"
                : pending === "reserve"
                  ? `${targets.length}か所を予約する`
                  : `${myReserved.length}か所を戻す`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

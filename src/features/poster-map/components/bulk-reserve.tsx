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
import {
  releaseMyReservationsAction,
  releaseMyStickerReservationsAction,
  reserveBoardsAction,
  reserveStickersAction,
} from "../actions";
import { toUserMessage } from "../errors";
import { BULK_RESERVE_MAX } from "../limits";
import { stickerDisplayOf } from "../map-view";
import { districtOf } from "../search";
import type { StickerStatus } from "../sticker-status";
import type { ActionResult, MapBoard } from "../types";

type Texts = {
  /** まだの状態の呼び方（「未貼付」「シール未」） */
  pending: string;
  reserveTitle: string;
  reserveNote: string;
  releaseNote: string;
};

type PanelProps = {
  districts: readonly string[];
  /** 選んでいる投票区の、予約できる掲示板 */
  targetIds: readonly string[];
  myReservedCount: number;
  texts: Texts;
  /** 予約できた数・戻した数を返す */
  reserve: (ids: string[]) => Promise<ActionResult<number>>;
  release: () => Promise<ActionResult<number>>;
};

type Pending = "reserve" | "release" | null;

/**
 * 選んでいる投票区のまだの掲示板をまとめて予約する・自分の予約をまとめて戻す。
 * 予約は時間がたっても消えないので、2 つをセットで出す。
 */
function BulkReservePanel({
  districts,
  targetIds,
  myReservedCount,
  texts,
  reserve,
  release,
}: PanelProps) {
  const [pending, setPending] = useState<Pending>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const targetCount = targetIds.length;
  const isTooMany = targetCount > BULK_RESERVE_MAX;
  const districtNames = districts.join("・");

  if (districts.length === 0 && myReservedCount === 0) return null;

  const open = (next: Pending) => {
    setError(null);
    setPending(next);
  };

  const handleConfirm = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      if (pending === "reserve") {
        const result = await reserve([...targetIds]);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        const skipped = targetCount - result.data;
        toast.success(
          skipped > 0
            ? `${result.data}か所を予約しました。${skipped}か所は、ほかの人が先に報告していました。`
            : `${result.data}か所を予約しました。`,
        );
      } else {
        const result = await release();
        if (!result.ok) {
          setError(result.error);
          return;
        }
        toast.success(`${result.data}か所を${texts.pending}に戻しました。`);
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
        (targetCount === 0 ? (
          <p className="text-muted-foreground text-xs">
            選んでいる投票区に、{texts.pending}の掲示板はありません。
          </p>
        ) : isTooMany ? (
          <p className="text-muted-foreground text-xs">
            選んでいる投票区の{texts.pending}は {targetCount}か所です。まとめて予約できるのは一度に
            {BULK_RESERVE_MAX}か所までなので、投票区を減らしてください。
          </p>
        ) : (
          <Button
            variant="outline"
            className="h-auto min-h-11 w-full whitespace-normal border-brand text-brand-dark"
            onClick={() => open("reserve")}
          >
            選んでいる投票区の{texts.pending} {targetCount}か所をまとめて予約
          </Button>
        ))}
      {myReservedCount > 0 && (
        <Button
          variant="ghost"
          className="h-auto min-h-11 w-full whitespace-normal text-muted-foreground"
          onClick={() => open("release")}
        >
          自分の予約 {myReservedCount}か所をまとめて{texts.pending}に戻す
        </Button>
      )}

      <Dialog
        open={pending !== null}
        onOpenChange={(next) => !next && !isSubmitting && setPending(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pending === "reserve" ? texts.reserveTitle : `まとめて${texts.pending}に戻す`}
            </DialogTitle>
            <DialogDescription>
              {pending === "reserve"
                ? `${districtNames}の${texts.pending} ${targetCount}か所を予約します。`
                : `自分の予約 ${myReservedCount}か所を${texts.pending}に戻します。`}
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm">{pending === "reserve" ? texts.reserveNote : texts.releaseNote}</p>
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
                  ? `${targetCount}か所を予約する`
                  : `${myReservedCount}か所を戻す`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function inDistricts(districts: readonly string[]) {
  const names = new Set(districts);
  return (b: MapBoard) => names.has(districtOf(b) ?? "");
}

const POSTER_TEXTS: Texts = {
  pending: "未貼付",
  reserveTitle: "まとめて予約",
  reserveNote:
    "ほかのボランティアの地図にも「予約」と表示され、「ここには私が行きます」と伝わります。その日に回りきれなかった掲示板は、「自分の予約をまとめて未貼付に戻す」で戻してください。",
  releaseNote:
    "貼り終えた掲示板があれば、先にピンから「完了」で報告してください。戻すと、ほかのボランティアの地図でも「未貼付」になります。",
};

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

/** ポスター: 選んでいる投票区の未貼付をまとめて予約する・自分の予約をまとめて未貼付に戻す */
export function BulkReserve({ boards, districts, myReservedIds, onUpdated }: Props) {
  const targetIds = boards
    .filter((b) => b.status === "not_yet" && inDistricts(districts)(b))
    .map((b) => b.id);
  const myReservedCount = boards.filter(
    (b) => b.status === "reserved" && myReservedIds.has(b.id),
  ).length;

  const withUpdate = (result: ActionResult<MapBoard[]>): ActionResult<number> => {
    if (!result.ok) return result;
    onUpdated(result.data);
    return { ok: true, data: result.data.length };
  };

  return (
    <BulkReservePanel
      districts={districts}
      targetIds={targetIds}
      myReservedCount={myReservedCount}
      texts={POSTER_TEXTS}
      reserve={async (ids) => withUpdate(await reserveBoardsAction(ids))}
      release={async () => withUpdate(await releaseMyReservationsAction())}
    />
  );
}

const STICKER_TEXTS: Texts = {
  pending: "シール未",
  reserveTitle: "シールをまとめて予約",
  reserveNote:
    "シールを貼りに行く掲示板として、ほかのボランティアの地図にも「予約」と表示されます。その日に回りきれなかった掲示板は、「自分の予約をまとめてシール未に戻す」で戻してください。",
  releaseNote:
    "シールを貼り終えた掲示板があれば、先にピンから「シール完了」で報告してください。戻すと、ほかのボランティアの地図でも「シール未」になります。",
};

type StickerProps = {
  boards: readonly MapBoard[];
  districts: readonly string[];
  stickers: ReadonlyMap<string, StickerStatus>;
  /** 自分のシールの予約 */
  myReservedIds: ReadonlySet<string>;
  /** まとめて予約した・戻した掲示板の id と、その新しい状態 */
  onUpdated: (ids: string[], status: StickerStatus) => void;
};

/** シール: 選んでいる投票区の「ポスター完了・シール未」をまとめて予約する・自分の予約をまとめて戻す */
export function StickerBulkReserve({
  boards,
  districts,
  stickers,
  myReservedIds,
  onUpdated,
}: StickerProps) {
  const targetIds = boards
    .filter((b) => stickerDisplayOf(b, stickers.get(b.id)) === "not_yet")
    .filter(inDistricts(districts))
    .map((b) => b.id);
  const myReservedCount = [...myReservedIds].filter((id) => stickers.get(id) === "reserved").length;

  const withUpdate = (
    result: ActionResult<string[]>,
    status: StickerStatus,
  ): ActionResult<number> => {
    if (!result.ok) return result;
    onUpdated(result.data, status);
    return { ok: true, data: result.data.length };
  };

  return (
    <BulkReservePanel
      districts={districts}
      targetIds={targetIds}
      myReservedCount={myReservedCount}
      texts={STICKER_TEXTS}
      reserve={async (ids) => withUpdate(await reserveStickersAction(ids), "reserved")}
      release={async () => withUpdate(await releaseMyStickerReservationsAction(), "not_yet")}
    />
  );
}

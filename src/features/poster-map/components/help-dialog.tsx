"use client";
// Derived from action-board (AGPL-3.0). See NOTICE.md. Modified 2026-10.
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BULK_RESERVE_MAX } from "../limits";
import { PIE_ORDER, STATUS_CONFIG, statusLabels } from "../status";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isVolunteer: boolean;
};

export function HelpDialog({ open, onOpenChange, isVolunteer }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>使い方</DialogTitle>
          <DialogDescription>地図の見方と操作</DialogDescription>
        </DialogHeader>

        <section className="space-y-2 text-sm">
          <h3 className="font-semibold">色の意味</h3>
          <ul className="grid grid-cols-2 gap-1">
            {PIE_ORDER.map((status) => (
              <li key={status} className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: STATUS_CONFIG[status].color }}
                />
                {statusLabels(status, isVolunteer).shortLabel}
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground">
            数字の入った円は、近くの掲示板をまとめたものです。円の色は内訳を表します。
          </p>
        </section>

        <section className="space-y-2 text-sm">
          <h3 className="font-semibold">操作</h3>
          <ul className="list-disc space-y-1 pl-5">
            <li>ピンを押すと、掲示板の番号・住所と地図アプリへのリンクが出ます。</li>
            <li>
              地図の上の「掲示板を探す」に、投票区・場所・住所の一部を入れると探せます。投票区を選ぶと、その投票区のピンだけを表示します。続けて選ぶと足していけます。
            </li>
            <li>
              担当の投票区を選んだ状態でブックマークやホーム画面に追加しておくと、次からは開くだけでその投票区が表示されます。
            </li>
            <li>右上の「フィルター」で、表示する状況を絞り込めます。</li>
            <li>
              現在地ボタンを押すと、今いる場所を地図に表示します。位置情報は、この端末の中だけで使います。
            </li>
          </ul>
        </section>

        {isVolunteer && (
          <section className="space-y-2 text-sm">
            <h3 className="font-semibold">ポスター貼りの流れ</h3>
            <ol className="list-decimal space-y-1 pl-5">
              <li>
                「掲示板を探す」で担当の投票区を選ぶ。その投票区のピンだけが出ます。担当が複数あるときは、続けて選ぶと足していけます。「フィルター」で「未貼付」だけにすると、まだ誰も向かっていない場所が分かります。
              </li>
              <li>
                向かう掲示板のピンを押して「予約」で報告します。ほかの人に「ここには私が行きます」と知らせるためのものです。ピンの「Google
                マップ」「Apple
                マップ」で道案内できます。投票区を選んでいるときは、検索欄の下のボタンで、その投票区の未貼付をまとめて予約できます（一度に
                {BULK_RESERVE_MAX}か所まで）。
              </li>
              <li>
                貼り終えたら、同じピンを押して「完了」で報告します。その場ですぐ貼れるときは、予約しないで「完了」だけでかまいません。
              </li>
              <li>
                行けなくなったら「未貼付」に戻してください。予約は時間がたっても消えません。「自分の予約をまとめて未貼付に戻す」で一度に戻せます。
              </li>
              <li>
                危なくて貼れない、ほかの候補者のポスターが貼られている、などのときは当てはまる状況を選び、連絡事項に様子を書いてください。
              </li>
            </ol>
          </section>
        )}

        <p className="text-sm">
          <Link href="/guide" className="underline">
            くわしい使い方ガイド
          </Link>
          （参加のしかた・困ったとき・選挙のルール）
        </p>
      </DialogContent>
    </Dialog>
  );
}

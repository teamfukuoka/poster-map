"use client";
// ポスターシール貼りチャレンジの受け付けの切り替え。ON の間だけ、地図に「ポスター｜シール」が出て、
// ボランティアがシールの報告・予約をできる。いまの状態は運営にも出し、切り替えは管理者だけ（DB も管理者だけを通す）。
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FALLBACK_MESSAGE } from "@/features/poster-map/errors";
import { setStickerEnabledAction } from "../actions";
import { ConfirmDialog } from "./confirm-dialog";
import { SectionTitle } from "./help-link";

const RELOAD_NOTE = "地図を開いたままの人は、再読み込みすると変わります。";

export function StickerControls({ enabled, canChange }: { enabled: boolean; canChange: boolean }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = async () => {
    try {
      const result = await setStickerEnabledAction(!enabled);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(enabled ? "シールの報告を止めました" : "シールの報告を始めました");
    } catch {
      setError(FALLBACK_MESSAGE);
    }
  };

  return (
    <section className="space-y-3">
      <SectionTitle help="site-sticker">シールの報告の受け付け</SectionTitle>
      <p className="text-sm">
        いまは<span className="font-semibold">{enabled ? "受け付け中" : "止めている"}</span>
        です。
        {enabled
          ? "ボランティアの地図に「ポスター｜シール」の切り替えが出ています。"
          : "ボランティアの地図はポスターだけです。"}
      </p>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      {canChange ? (
        <Button
          type="button"
          variant={enabled ? "outline" : "default"}
          onClick={() => {
            setError(null);
            setOpen(true);
          }}
        >
          {enabled ? "シールの報告を止める" : "シールの報告を始める"}
        </Button>
      ) : (
        <p className="text-muted-foreground text-sm">切り替えは管理者だけができます。</p>
      )}

      <ConfirmDialog
        open={open}
        onOpenChange={(next) => !next && setOpen(false)}
        title={enabled ? "シールの報告を止めますか" : "シールの報告を始めますか"}
        description={
          enabled ? (
            <>
              <p>
                ボランティアの地図から「ポスター｜シール」の切り替えが消え、シールの報告と予約ができなくなります。これまでの報告は消えません。
              </p>
              <p>{RELOAD_NOTE}</p>
            </>
          ) : (
            <>
              <p>
                ボランティアの地図に「ポスター｜シール」の切り替えが出て、最初はシールの表示で開きます。一般の人の画面は変わりません。
              </p>
              <p>{RELOAD_NOTE}</p>
            </>
          )
        }
        confirmLabel={enabled ? "止める" : "始める"}
        onConfirm={toggle}
      />
    </section>
  );
}

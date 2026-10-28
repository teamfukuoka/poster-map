"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FALLBACK_MESSAGE } from "@/features/poster-map/errors";
import { resetRehearsalAction } from "../actions";
import { RESET_CONFIRM_WORD } from "../validation";
import { ConfirmDialog } from "./confirm-dialog";
import { SectionTitle } from "./help-link";

/**
 * リハーサルの報告をまとめて戻す。管理者にだけ描く。
 * canReset は、締切（rehearsal_reset_until）より前かどうか（サーバーで決めて渡す）。
 * 画面で隠しても、締切後は DB が reset_closed で断る。
 */
export function ResetRehearsal({ canReset }: { canReset: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = async () => {
    try {
      const result = await resetRehearsalAction(RESET_CONFIRM_WORD);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success("報告をまとめて戻しました");
    } catch {
      setError(FALLBACK_MESSAGE);
    }
  };

  return (
    <section className="space-y-3">
      <SectionTitle help="site-reset">報告をまとめて戻す</SectionTitle>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      {canReset ? (
        <>
          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              setError(null);
              setIsOpen(true);
            }}
          >
            報告をまとめて戻す
          </Button>
          <ConfirmDialog
            open={isOpen}
            onOpenChange={setIsOpen}
            title="報告をまとめて戻しますか"
            description={
              <p>
                すべての報告の履歴を消し、すべての掲示場を「未貼付」に戻します。元に戻せません。リハーサルの片付けは10月31日のうちに済ませてください。
              </p>
            }
            confirmLabel="まとめて戻す"
            confirmWord={RESET_CONFIRM_WORD}
            destructive
            onConfirm={reset}
          />
        </>
      ) : (
        <p className="text-sm">11月1日0:00を過ぎたため、この操作は終わりました。</p>
      )}
    </section>
  );
}

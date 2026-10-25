"use client";
import { type ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  /** 指定すると入力欄が出て、一致するまで実行ボタンを押せない */
  confirmWord?: string;
  /**
   * 実行する処理。終わると（成功でも失敗でも）ダイアログを閉じる。
   * 失敗の表示は呼び出し側が自分で catch して行う。ここに届いた例外は console.error に出して閉じる。
   */
  onConfirm: () => Promise<void>;
  destructive?: boolean;
};

/** 実行前に確かめる小さなダイアログ。開くたびに入力欄と実行中の状態をまっさらにする */
export function ConfirmDialog({ open, onOpenChange, ...rest }: Props) {
  // 実行中は閉じさせない（Escape・外側のクリック・onOpenChange(false)）。
  // 閉じても処理は続くので、結果が見えないまま二度押しされるのを防ぐ
  const [isRunning, setIsRunning] = useState(false);
  const blockWhileRunning = (event: Event) => {
    if (isRunning) event.preventDefault();
  };
  return (
    <Dialog open={open} onOpenChange={(next) => !(isRunning && !next) && onOpenChange(next)}>
      {/* DialogContent は閉じると外れるので、中の状態は開くたびに作り直される */}
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={blockWhileRunning}
        onPointerDownOutside={blockWhileRunning}
        onInteractOutside={blockWhileRunning}
      >
        <ConfirmBody
          onOpenChange={onOpenChange}
          isRunning={isRunning}
          setIsRunning={setIsRunning}
          {...rest}
        />
      </DialogContent>
    </Dialog>
  );
}

function ConfirmBody({
  onOpenChange,
  title,
  description,
  confirmLabel,
  confirmWord,
  onConfirm,
  destructive,
  isRunning,
  setIsRunning,
}: Omit<Props, "open"> & { isRunning: boolean; setIsRunning: (running: boolean) => void }) {
  const [typed, setTyped] = useState("");
  const matches = confirmWord === undefined || typed === confirmWord;

  const run = async () => {
    setIsRunning(true);
    try {
      await onConfirm();
    } catch (error) {
      // 呼び出し側が自分で catch して画面に出す前提。ここまで届いたものは握りつぶさず記録する
      console.error(error);
    } finally {
      setIsRunning(false);
      onOpenChange(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription asChild>
          <div className="space-y-3">{description}</div>
        </DialogDescription>
      </DialogHeader>
      {confirmWord !== undefined && (
        <div className="space-y-2">
          <Label htmlFor="confirm-word">確認のため「{confirmWord}」と入力してください</Label>
          <Input
            id="confirm-word"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>
      )}
      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          disabled={isRunning}
          onClick={() => onOpenChange(false)}
        >
          やめる
        </Button>
        <Button
          type="button"
          variant={destructive ? "destructive" : "default"}
          disabled={!matches || isRunning}
          onClick={run}
        >
          {confirmLabel}
        </Button>
      </DialogFooter>
    </>
  );
}

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
   * 失敗の表示は呼び出し側が行う（ここでは例外を握りつぶさず、閉じるだけ）。
   */
  onConfirm: () => Promise<void>;
  destructive?: boolean;
};

/** 実行前に確かめる小さなダイアログ。開くたびに入力欄と実行中の状態をまっさらにする */
export function ConfirmDialog({ open, onOpenChange, ...rest }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* DialogContent は閉じると外れるので、中の状態は開くたびに作り直される */}
      <DialogContent showCloseButton={false}>
        <ConfirmBody onOpenChange={onOpenChange} {...rest} />
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
}: Omit<Props, "open">) {
  const [typed, setTyped] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const matches = confirmWord === undefined || typed === confirmWord;

  const run = async () => {
    setIsRunning(true);
    try {
      await onConfirm();
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

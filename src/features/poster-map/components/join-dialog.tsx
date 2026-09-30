"use client";
import Link from "next/link";
import { type FormEvent, useState } from "react";
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
import { joinAction } from "../actions";
import { DISPLAY_NAME_MAX_LENGTH } from "../limits";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onJoined: (displayName: string) => void;
};

export function JoinDialog({ open, onOpenChange, onJoined }: Props) {
  const [code, setCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    const result = await joinAction(code, displayName);
    setIsSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setCode("");
    onJoined(result.data.displayName);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>ボランティアとして参加</DialogTitle>
            <DialogDescription>
              運営から受け取った参加コードと、報告に表示するニックネームを入力してください。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="join-code">参加コード</Label>
            <Input
              id="join-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoComplete="off"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="join-name">ニックネーム</Label>
            <Input
              id="join-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={DISPLAY_NAME_MAX_LENGTH}
              autoComplete="nickname"
              required
            />
            <p className="text-muted-foreground text-xs">
              呼び名で大丈夫です。ほかのボランティアに表示されます。
            </p>
          </div>
          <p className="text-muted-foreground text-xs">
            この端末に参加の記録（Cookie）を保存します。登録するのはニックネームだけです。
            <Link href="/privacy" target="_blank" className="ml-1 underline">
              プライバシーについて
            </Link>
          </p>
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              キャンセル
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "確認中…" : "参加する"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

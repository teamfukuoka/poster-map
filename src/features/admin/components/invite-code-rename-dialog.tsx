"use client";
import { type FormEvent, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FALLBACK_MESSAGE } from "@/features/poster-map/errors";
import { renameInviteCodeAction } from "../actions";
import type { InviteCodeRow } from "../types";
import { LABEL_MAX_LENGTH, validateLabel } from "../validation";

type Props = {
  /** 直す行。null なら閉じている */
  row: InviteCodeRow | null;
  onClose: () => void;
};

/** 配布先の名前を直す。コードそのものと、参加した人はそのまま */
export function InviteCodeRenameDialog({ row, onClose }: Props) {
  return (
    <Dialog open={row !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {/* 閉じると外れるので、開くたびに今の名前から始まる */}
        {row && <RenameBody row={row} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function RenameBody({ row, onClose }: { row: InviteCodeRow; onClose: () => void }) {
  const [label, setLabel] = useState(row.label);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const message = validateLabel(label.trim());
    if (message) {
      setError(message);
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await renameInviteCodeAction(row.id, label);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success("配布先の名前を直しました");
      onClose();
    } catch {
      setError(FALLBACK_MESSAGE);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <DialogHeader>
        <DialogTitle>配布先の名前を直す</DialogTitle>
        <DialogDescription>
          コードはそのままです。このコードで参加した人も、そのまま使えます。
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-2">
        <Label htmlFor="invite-rename-label">配布先の名前</Label>
        <Input
          id="invite-rename-label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          maxLength={LABEL_MAX_LENGTH}
          autoComplete="off"
        />
        <p className="text-muted-foreground text-xs">
          本名・電話番号・住所は入れないでください（例：東区チーム、11/1 説明会）。
        </p>
      </div>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
          やめる
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "保存中…" : "保存する"}
        </Button>
      </DialogFooter>
    </form>
  );
}

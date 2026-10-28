"use client";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FALLBACK_MESSAGE } from "@/features/poster-map/errors";
import { addMemberAction } from "../actions";
import { ROLE_LABELS } from "../role-labels";
import type { AdminRole } from "../types";
import { MEMBER_EMAIL_MAX_LENGTH, normalizeMemberEmail, validateMemberEmail } from "../validation";
import { ConfirmDialog } from "./confirm-dialog";
import { SectionTitle } from "./help-link";

const ROLE_OPTIONS: { value: AdminRole; help: string }[] = [
  {
    value: "operator",
    help: "最初の画面・参加コードの一覧・カバー地域・操作の記録を使えます。カバー地域の担当者の登録もできます。",
  },
  {
    value: "admin",
    help: "すべての操作ができます。参加コードの登録と失効、公開の切り替え、管理メンバーの登録は管理者だけです。",
  },
];

/** 管理メンバーの登録（管理者だけ）。送る値は入力のまま。全角・前後の空白・大文字はサーバー側でもそろえる */
export function MemberForm() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AdminRole>("operator");
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const message = validateMemberEmail(normalizeMemberEmail(email));
    if (message) {
      setError(message);
      return;
    }
    setError(null);
    setConfirming(true);
  };

  const add = async () => {
    try {
      const result = await addMemberAction(email, role);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setEmail("");
      setRole("operator");
      setError(null);
      toast.success("登録しました");
    } catch {
      // 通信の切断や再デプロイで reject することがある
      setError(FALLBACK_MESSAGE);
    }
  };

  return (
    <section className="space-y-3">
      <SectionTitle help="members-add">管理メンバーを登録する</SectionTitle>
      <p className="text-sm">
        登録した人は、そのメールアドレスの Google アカウントでログインすると管理画面に入れます。
      </p>
      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-lg bg-card p-3 shadow-card"
        noValidate
      >
        <div className="space-y-2">
          <Label htmlFor="member-email">メールアドレス</Label>
          <Input
            id="member-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={MEMBER_EMAIL_MAX_LENGTH}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-describedby="member-email-help"
          />
          <p id="member-email-help" className="text-muted-foreground text-xs">
            ログインに使う Google アカウントのメールアドレスを入れてください。
          </p>
        </div>
        <fieldset className="space-y-2">
          <legend className="font-medium text-sm">役割</legend>
          {ROLE_OPTIONS.map((option) => (
            <label key={option.value} className="flex items-start gap-2">
              <input
                type="radio"
                name="member-role"
                value={option.value}
                checked={role === option.value}
                onChange={() => setRole(option.value)}
                className="mt-1 size-4 accent-brand"
              />
              <span className="space-y-0.5">
                <span className="block text-sm">{ROLE_LABELS[option.value]}</span>
                <span className="block text-muted-foreground text-xs">{option.help}</span>
              </span>
            </label>
          ))}
        </fieldset>
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        <Button type="submit">登録する</Button>
      </form>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="この人を管理メンバーに登録しますか"
        description={
          <>
            <p>
              メールアドレス:{" "}
              <span className="break-all font-bold text-foreground">
                {normalizeMemberEmail(email)}
              </span>
            </p>
            <p>
              役割: <span className="font-bold text-foreground">{ROLE_LABELS[role]}</span>
            </p>
          </>
        }
        confirmLabel="登録する"
        onConfirm={add}
      />
    </section>
  );
}

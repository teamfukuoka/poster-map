"use client";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FALLBACK_MESSAGE } from "@/features/poster-map/errors";
import { passwordLoginAction, startGoogleLoginAction } from "../auth-actions";

type Props = { showPasswordLogin: boolean; hasError: boolean };

const LOGIN_FAILED = "ログインできませんでした。もう一度お試しください。";

export function LoginForm({ showPasswordLogin, hasError }: Props) {
  const [error, setError] = useState<string | null>(hasError ? LOGIN_FAILED : null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleGoogle = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await startGoogleLoginAction();
      if (!result.ok) {
        setError(result.error);
        setIsSubmitting(false);
        return;
      }
      // Google の認可画面へ移動する（戻り先は /auth/callback）
      window.location.assign(result.data.url);
    } catch {
      setError(FALLBACK_MESSAGE);
      setIsSubmitting(false);
    }
  };

  const handlePassword = async (event: FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await passwordLoginAction(email, password);
      if (!result.ok) {
        setError(result.error);
        setIsSubmitting(false);
        return;
      }
      window.location.assign("/admin");
    } catch {
      setError(FALLBACK_MESSAGE);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-md space-y-4 py-6">
      <h1 className="font-bold text-xl">運営ログイン</h1>
      <p className="text-sm">運営の一覧に登録された Google アカウントで入れます。</p>
      <p className="text-muted-foreground text-sm">
        このブラウザでボランティアとして参加している場合、ログインすると参加の記録が外れます。ボランティアとして報告するときは、別のブラウザかスマホを使ってください。
      </p>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <Button type="button" onClick={handleGoogle} disabled={isSubmitting}>
        Google でログイン
      </Button>
      {showPasswordLogin && (
        <form onSubmit={handlePassword} className="space-y-3 border-t pt-4">
          <p className="text-muted-foreground text-xs">ローカルの確認用です。</p>
          <div className="space-y-2">
            <Label htmlFor="admin-email">メールアドレス</Label>
            <Input
              id="admin-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-password">パスワード</Label>
            <Input
              id="admin-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          <Button type="submit" variant="outline" disabled={isSubmitting}>
            パスワードでログイン
          </Button>
        </form>
      )}
    </div>
  );
}

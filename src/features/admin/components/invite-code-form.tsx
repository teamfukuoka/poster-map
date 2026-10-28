"use client";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FALLBACK_MESSAGE } from "@/features/poster-map/errors";
import { registerInviteCodeAction } from "../actions";
import {
  LABEL_MAX_LENGTH,
  normalizeInviteCode,
  validateInviteCode,
  validateLabel,
} from "../validation";
import { ConfirmDialog } from "./confirm-dialog";
import { SectionTitle } from "./help-link";

/** 参加コードの登録（管理者だけに出す）。送る値は入力のまま。前後の空白や全角はサーバー側でもそろえる */
export function InviteCodeForm() {
  const [label, setLabel] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    // 画面でも先に確かめる。コードは正規化（全角→半角・前後の空白）してから調べる
    const message = validateLabel(label.trim()) ?? validateInviteCode(normalizeInviteCode(code));
    if (message) {
      setError(message);
      return;
    }
    setError(null);
    setConfirming(true);
  };

  const register = async () => {
    try {
      const result = await registerInviteCodeAction(label, code);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setLabel("");
      setCode("");
      setError(null);
      toast.success("登録しました");
    } catch {
      // 通信の切断や再デプロイで reject することがある
      setError(FALLBACK_MESSAGE);
    }
  };

  return (
    <section className="space-y-3">
      <SectionTitle help="codes-register">参加コードを登録する</SectionTitle>
      <p className="text-sm">
        参加コードはいくつでも登録できます。配る相手ごとに分けておくと、もれたときにそのコードだけ止められます。
      </p>
      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-lg bg-card p-3 shadow-card"
        noValidate
      >
        <div className="space-y-2">
          <Label htmlFor="invite-label">配布先の名前</Label>
          <Input
            id="invite-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={LABEL_MAX_LENGTH}
            aria-describedby="invite-label-help"
          />
          <p id="invite-label-help" className="text-muted-foreground text-xs">
            個人名ではなく、配る相手のまとまり（例: 東区リーダー配布）を入れてください。
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="invite-code">参加コード</Label>
          <Input
            id="invite-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-describedby="invite-code-help"
          />
          <p id="invite-code-help" className="text-muted-foreground text-xs">
            英字・数字・記号をそれぞれ1つ以上入れて、8文字以上にしてください。記号はスマホで打ちやすい「-」や「_」がおすすめです。登録したコードは、あとからこの画面の「表示」で確かめられます。
          </p>
        </div>
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
        title="この参加コードを登録しますか"
        description={
          <p>
            配布先の名前: <span className="font-bold text-foreground">{label.trim()}</span>
          </p>
        }
        confirmLabel="登録する"
        onConfirm={register}
      />
    </section>
  );
}

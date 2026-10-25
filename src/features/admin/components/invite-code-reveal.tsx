"use client";
import { Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FALLBACK_MESSAGE } from "@/features/poster-map/errors";
import { revealInviteCodeAction } from "../actions";

type State =
  | { kind: "hidden" }
  | { kind: "loading" }
  | { kind: "shown"; code: string }
  | { kind: "unavailable" }
  | { kind: "error"; message: string };

const UNAVAILABLE = "以前の方法で登録したため表示できません";

async function copyCode(code: string) {
  try {
    await navigator.clipboard.writeText(code);
    toast.success("コピーしました");
  } catch {
    toast.error("コピーできませんでした");
  }
}

/**
 * コードの欄。ページの HTML にコードは入れず、「表示」を押したときにだけサーバーから取る。
 * 取るたびに操作の記録が残る（RPC 側）。
 */
export function InviteCodeReveal({ id, hasCode }: { id: string; hasCode: boolean }) {
  const [state, setState] = useState<State>({ kind: "hidden" });

  if (!hasCode) return <span className="text-muted-foreground text-xs">{UNAVAILABLE}</span>;

  const reveal = async () => {
    setState({ kind: "loading" });
    try {
      const result = await revealInviteCodeAction(id);
      if (!result.ok) {
        setState({ kind: "error", message: result.error });
      } else if (result.data.code === null) {
        setState({ kind: "unavailable" });
      } else {
        setState({ kind: "shown", code: result.data.code });
      }
    } catch {
      setState({ kind: "error", message: FALLBACK_MESSAGE });
    }
  };

  if (state.kind === "shown") {
    return (
      <span className="inline-flex items-center gap-2">
        <code className="whitespace-nowrap font-mono">{state.code}</code>
        <Button type="button" variant="outline" size="sm" onClick={() => copyCode(state.code)}>
          <Copy aria-hidden />
          コピー
        </Button>
      </span>
    );
  }
  if (state.kind === "unavailable") {
    return <span className="text-muted-foreground text-xs">{UNAVAILABLE}</span>;
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={state.kind === "loading"}
        onClick={reveal}
      >
        表示
      </Button>
      {state.kind === "error" && (
        <span role="alert" className="text-destructive text-xs">
          {state.message}
        </span>
      )}
    </span>
  );
}

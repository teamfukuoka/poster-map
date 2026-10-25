"use client";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FALLBACK_MESSAGE } from "@/features/poster-map/errors";
import { publishSiteAction, revertAcceptanceAction, setForceHiddenAction } from "../actions";
import { formatJst, siteStateLabel } from "../dashboard-view";
import type { SiteState } from "../types";
import { PUBLISH_CONFIRM_WORD, REVERT_CONFIRM_WORD } from "../validation";
import { ConfirmDialog } from "./confirm-dialog";
import { SiteStateBadge } from "./site-state-badge";

const CACHE_NOTE = "一般の人の画面には、最大60秒ほど前の表示が残ります。";

type DialogName = "stop" | "resume" | "publish" | "revert";

/** いまの状態。運営（操作できない人）にも出す */
export function SiteStatus({ site }: { site: SiteState }) {
  return (
    <section className="space-y-2 rounded-lg bg-card p-3 shadow-card">
      <SiteStateBadge label={siteStateLabel(site)} />
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted-foreground">公開期間の始まり</dt>
        <dd>{formatJst(site.public_from)}</dd>
        <dt className="text-muted-foreground">公開期間の終わり</dt>
        <dd>{formatJst(site.public_until)}</dd>
        <dt className="text-muted-foreground">サイト名</dt>
        <dd>{site.site_name}</dd>
        <dt className="text-muted-foreground">受理の確認</dt>
        <dd>{site.accepted_at ? `済み（${formatJst(site.accepted_at)}）` : "まだ"}</dd>
      </dl>
    </section>
  );
}

/**
 * 公開の切り替え。管理者にだけ描く（DB の RPC も管理者だけを通す）。
 * beforePublicFrom は、公開期間の始まりより前かどうか（サーバーで決めて渡す）。
 * 受理前は「公開する」だけが再開の手段（DB が not_accepted で断る）。
 */
export function SiteControls({
  site,
  beforePublicFrom,
}: {
  site: SiteState;
  beforePublicFrom: boolean;
}) {
  const [dialog, setDialog] = useState<DialogName | null>(null);
  const [error, setError] = useState<string | null>(null);
  const accepted = site.accepted_at !== null;

  const open = (name: DialogName) => {
    setError(null);
    setDialog(name);
  };

  const run = (success: string, action: () => ReturnType<typeof setForceHiddenAction>) => {
    return async () => {
      try {
        const result = await action();
        if (!result.ok) {
          setError(result.error);
          return;
        }
        toast.success(success);
      } catch {
        setError(FALLBACK_MESSAGE);
      }
    };
  };

  const stop = run("一般の人への公開を止めました", () => setForceHiddenAction(true));
  const resume = run("公開を再開しました", () => setForceHiddenAction(false));
  const publish = run("公開しました", () => publishSiteAction(PUBLISH_CONFIRM_WORD));
  const revert = run("受理前に戻しました", () => revertAcceptanceAction(REVERT_CONFIRM_WORD));

  const stopButton = (
    <Button type="button" variant="outline" onClick={() => open("stop")}>
      一般の人への公開を止める
    </Button>
  );

  let buttons: ReactNode;
  if (accepted) {
    buttons = site.force_hidden ? (
      <Button type="button" onClick={() => open("resume")}>
        公開を再開する
      </Button>
    ) : (
      stopButton
    );
  } else {
    buttons = (
      <>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" disabled={beforePublicFrom} onClick={() => open("publish")}>
            公開する
          </Button>
          {beforePublicFrom && (
            <span className="text-muted-foreground text-sm">11月1日0:00から押せます。</span>
          )}
        </div>
        {!site.force_hidden && stopButton}
      </>
    );
  }

  return (
    <section className="space-y-3">
      <h2 className="font-bold text-brand-dark">公開の切り替え</h2>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">{buttons}</div>
      {accepted && (
        <div className="pt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive"
            onClick={() => open("revert")}
          >
            受理前に戻す
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={dialog === "stop"}
        onOpenChange={(next) => !next && setDialog(null)}
        title="一般の人への公開を止めますか"
        description={
          <>
            <p>止めても、参加済みのボランティアはそのまま使えます。</p>
            <p>{CACHE_NOTE}</p>
          </>
        }
        confirmLabel="止める"
        onConfirm={stop}
      />
      <ConfirmDialog
        open={dialog === "resume"}
        onOpenChange={(next) => !next && setDialog(null)}
        title="公開を再開しますか"
        description={<p>{CACHE_NOTE}</p>}
        confirmLabel="再開する"
        onConfirm={resume}
      />
      <ConfirmDialog
        open={dialog === "publish"}
        onOpenChange={(next) => !next && setDialog(null)}
        title="公開しますか"
        description={
          <p>
            立候補の届出が受理されたことを確かめてから押してください。サイト名が「佐々木あやの
            ポスター掲示板マップ」に変わり、一般の人に地図が公開されます。{CACHE_NOTE}
          </p>
        }
        confirmLabel="公開する"
        confirmWord={PUBLISH_CONFIRM_WORD}
        onConfirm={publish}
      />
      <ConfirmDialog
        open={dialog === "revert"}
        onOpenChange={(next) => !next && setDialog(null)}
        title="受理前に戻しますか"
        description={
          <p>
            押し間違えたときだけ使います。サイト名を「福岡市ポスター掲示板マップ」に戻し、一般の人への公開を止めます。
          </p>
        }
        confirmLabel="受理前に戻す"
        confirmWord={REVERT_CONFIRM_WORD}
        destructive
        onConfirm={revert}
      />
    </section>
  );
}

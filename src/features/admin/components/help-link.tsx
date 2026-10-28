import Link from "next/link";
import type { ReactNode } from "react";
import { type HelpId, helpHref, helpTitle } from "../help-sections";

/** 見出しの横に置く「くわしく」。ヘルプの該当する節に飛ぶ */
export function HelpLink({ id }: { id: HelpId }) {
  return (
    <Link
      href={helpHref(id)}
      aria-label={`${helpTitle(id)}のくわしい説明`}
      className="text-muted-foreground text-xs underline underline-offset-2 hover:text-foreground"
    >
      くわしく
    </Link>
  );
}

/** 管理画面の h2 と「くわしく」を並べる */
export function SectionTitle({ help, children }: { help: HelpId; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2">
      <h2 className="font-bold text-brand-dark">{children}</h2>
      <HelpLink id={help} />
    </div>
  );
}

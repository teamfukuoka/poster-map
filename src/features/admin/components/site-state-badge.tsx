import { cn } from "@/lib/utils";
import type { SiteStateLabel } from "../dashboard-view";

const STYLES: Record<SiteStateLabel, string> = {
  公開中: "bg-brand-light text-brand-dark",
  止めている: "bg-destructive/10 text-destructive",
  期間外: "bg-muted text-muted-foreground",
};

/** 公開の状態（期間外／公開中／止めている）を小さく出す */
export function SiteStateBadge({ label }: { label: SiteStateLabel }) {
  return (
    <p className="text-sm">
      <span className="text-muted-foreground">地図の公開: </span>
      <span className={cn("rounded-full px-3 py-1 font-bold", STYLES[label])}>{label}</span>
    </p>
  );
}

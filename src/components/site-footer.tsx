import Link from "next/link";
import type { SiteConfig } from "@/lib/site-config";

export function SiteFooter({ config }: { config: SiteConfig }) {
  return (
    <footer className="mt-8 bg-ink px-4 py-6 text-white text-xs">
      <div className="mx-auto max-w-5xl space-y-1.5">
        <p>
          運営：{config.operatorName}（連絡先：
          <a href={config.contact.href} className="underline">
            {config.contact.label}
          </a>
          ）
        </p>
        <p>
          地図：
          <a
            href="https://maps.gsi.go.jp/development/ichiran.html"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            国土地理院
          </a>
        </p>
        <p className="flex flex-wrap gap-x-4">
          <a
            href={config.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            ソースコード（AGPL-3.0）
          </a>
          <Link href="/guide" className="underline">
            使い方ガイド
          </Link>
          <Link href="/privacy" className="underline">
            プライバシーについて
          </Link>
        </p>
      </div>
    </footer>
  );
}

import { MapPin } from "lucide-react";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SiteFooter } from "@/components/site-footer";
import { Toaster } from "@/components/ui/sonner";
import { readSiteConfig } from "@/lib/site-config";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const { siteName } = readSiteConfig();
  // 検索エンジンには載せない（URL を知っている人に向けた道具）
  return { title: siteName, robots: { index: false, follow: false } };
}

export default function RootLayout({ children }: { children: ReactNode }) {
  const config = readSiteConfig();
  return (
    <html lang="ja">
      <body className="min-h-dvh bg-background text-foreground">
        <header className="border-b bg-background">
          <div aria-hidden className="h-1 bg-gradient-to-r from-brand-deep to-brand" />
          <div className="mx-auto max-w-5xl px-4 py-3">
            <a href="/" className="inline-flex items-center gap-2 font-bold text-ink text-lg">
              <MapPin aria-hidden className="h-5 w-5 text-brand" strokeWidth={2.5} />
              {config.siteName}
            </a>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-4">{children}</main>
        <SiteFooter config={config} />
        <Toaster position="top-center" />
      </body>
    </html>
  );
}

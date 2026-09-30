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
        <header className="border-b px-4 py-3">
          <div className="mx-auto max-w-5xl">
            <a href="/" className="font-bold text-lg">
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

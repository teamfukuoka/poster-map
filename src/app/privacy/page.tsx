import type { Metadata } from "next";
import { readSiteConfig } from "@/lib/site-config";

export const metadata: Metadata = { title: "プライバシーについて" };

/** 公開前に陣営の承認と election-law-check・redteam-check を通す文言 */
export default function PrivacyPage() {
  const config = readSiteConfig();
  return (
    <article className="prose-sm max-w-2xl space-y-4 text-sm leading-relaxed">
      <h1 className="font-bold text-xl">プライバシーについて</h1>

      <section className="space-y-1">
        <h2 className="font-semibold">地図を見るだけの方</h2>
        <p>
          地図は、登録なし・Cookie
          なしで見られます。現在地ボタンで使う位置情報は、この端末の中だけで使います。
        </p>
      </section>

      <section className="space-y-1">
        <h2 className="font-semibold">参加コードで参加した方</h2>
        <p>保存するのは、次の 6 つです。</p>
        <ul className="list-disc pl-5">
          <li>ニックネーム（20 文字まで）</li>
          <li>この端末を識別するための Cookie（ランダムな ID）</li>
          <li>参加に使った参加コードの種類（配布先ごとの区別）</li>
          <li>参加した日時</li>
          <li>参加コードの入力に失敗した日時（続けて失敗した回数を数えるため）</li>
          <li>報告の内容（状況・連絡事項・日時）</li>
        </ul>
        <p>
          ニックネーム・連絡事項・報告の履歴は、参加している方だけが見られます。一般に公開するのは、地図上の掲示板の状況と件数だけです。
        </p>
      </section>

      <section className="space-y-1">
        <h2 className="font-semibold">保存する場所と期間</h2>
        <p>
          データは Supabase（東京リージョン）に保存し、サイトは
          Vercel（東京リージョン）で動かしています。すべてのデータは
          2026年12月15日までに削除します。
        </p>
        <p>
          地図の画像は国土地理院のサーバーから読み込みます。Vercel
          と国土地理院は、通常のアクセスログ（IP
          アドレスなど）を、それぞれの規定に従って記録します。
        </p>
      </section>

      {config.operatorPrivacyUrl && (
        <section className="space-y-1">
          <h2 className="font-semibold">運営者のプライバシーポリシー</h2>
          <p>
            このページは、この地図で扱う情報についての説明です。
            {config.operatorName}の
            <a
              href={config.operatorPrivacyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              プライバシーポリシー
            </a>
            もあわせてご覧ください。
          </p>
        </section>
      )}

      <section className="space-y-1">
        <h2 className="font-semibold">お問い合わせ</h2>
        <p>
          {config.operatorName}（
          <a href={config.contact.href} className="underline">
            {config.contact.label}
          </a>
          ）
        </p>
      </section>
    </article>
  );
}

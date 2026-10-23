// フッターに出す運営者・連絡先（公選法 142条の3 の表示）。Vercel の環境変数で設定する。
export type SiteConfig = {
  siteName: string;
  operatorName: string;
  contact: { label: string; href: string };
  sourceUrl: string;
  /** 運営者のプライバシーポリシー（公式サイトなど）。任意 */
  operatorPrivacyUrl?: string;
};

type SiteEnv = Record<string, string | undefined>;
type SiteKey = "SITE_NAME" | "OPERATOR_NAME" | "CONTACT" | "SOURCE_URL" | "OPERATOR_PRIVACY_URL";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function required(env: SiteEnv, key: SiteKey): string {
  const value = env[key]?.trim();
  if (!value) throw new Error(`${key} を設定してください（.env.example 参照）`);
  return value;
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export function readSiteConfig(env: SiteEnv = process.env): SiteConfig {
  const contact = required(env, "CONTACT");
  let href: string;
  if (EMAIL.test(contact)) {
    href = `mailto:${contact}`;
  } else if (isHttpsUrl(contact)) {
    href = contact;
  } else {
    throw new Error("CONTACT はメールアドレスか https の URL にしてください");
  }

  const sourceUrl = required(env, "SOURCE_URL");
  if (!isHttpsUrl(sourceUrl)) {
    throw new Error("SOURCE_URL は https の URL にしてください");
  }

  const operatorPrivacyUrl = env.OPERATOR_PRIVACY_URL?.trim() || undefined;
  if (operatorPrivacyUrl && !isHttpsUrl(operatorPrivacyUrl)) {
    throw new Error("OPERATOR_PRIVACY_URL は https の URL にしてください");
  }

  return {
    siteName: required(env, "SITE_NAME"),
    operatorName: required(env, "OPERATOR_NAME"),
    contact: { label: contact, href },
    sourceUrl,
    operatorPrivacyUrl,
  };
}

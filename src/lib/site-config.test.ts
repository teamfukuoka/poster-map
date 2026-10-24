import { readSiteConfig } from "./site-config";

const base = {
  SITE_NAME: "福岡市 ポスター掲示板マップ",
  OPERATOR_NAME: "ポスター掲示板マップ運営",
  CONTACT: "map@example.jp",
  SOURCE_URL: "https://github.com/example/poster-map",
};

describe("readSiteConfig", () => {
  test("メールアドレスは mailto のリンクにする", () => {
    expect(readSiteConfig(base)).toEqual({
      siteName: "福岡市 ポスター掲示板マップ",
      operatorName: "ポスター掲示板マップ運営",
      contact: { label: "map@example.jp", href: "mailto:map@example.jp" },
      sourceUrl: "https://github.com/example/poster-map",
    });
  });

  test("https の URL はそのままリンクにする", () => {
    const config = readSiteConfig({ ...base, CONTACT: "https://forms.example.jp/x" });
    expect(config.contact).toEqual({
      label: "https://forms.example.jp/x",
      href: "https://forms.example.jp/x",
    });
  });

  test.each([
    "SITE_NAME",
    "OPERATOR_NAME",
    "CONTACT",
    "SOURCE_URL",
  ] as const)("%s が空なら throw する", (key) => {
    expect(() => readSiteConfig({ ...base, [key]: " " })).toThrow(key);
  });

  test("連絡先がメールでも https でもなければ throw する", () => {
    expect(() => readSiteConfig({ ...base, CONTACT: "090-0000-0000" })).toThrow("CONTACT");
  });

  test("OPERATOR_PRIVACY_URL は任意で、あれば返す", () => {
    expect(readSiteConfig(base).operatorPrivacyUrl).toBeUndefined();
    expect(
      readSiteConfig({ ...base, OPERATOR_PRIVACY_URL: " " }).operatorPrivacyUrl,
    ).toBeUndefined();
    expect(
      readSiteConfig({ ...base, OPERATOR_PRIVACY_URL: "https://example.jp/privacypolicy/" })
        .operatorPrivacyUrl,
    ).toBe("https://example.jp/privacypolicy/");
  });

  test("OPERATOR_PRIVACY_URL が https でなければ throw する", () => {
    expect(() =>
      readSiteConfig({ ...base, OPERATOR_PRIVACY_URL: "http://example.jp/privacypolicy/" }),
    ).toThrow("OPERATOR_PRIVACY_URL");
  });

  test("SOURCE_URL が https でなければ throw する", () => {
    expect(() => readSiteConfig({ ...base, SOURCE_URL: "http://example.jp" })).toThrow(
      "SOURCE_URL",
    );
  });

  test("ボランティア向けの問い合わせ先は任意で、空白だけなら未設定として扱う", () => {
    expect(readSiteConfig(base).volunteerContact).toBeUndefined();
    expect(readSiteConfig({ ...base, VOLUNTEER_CONTACT: " " }).volunteerContact).toBeUndefined();
    expect(readSiteConfig({ ...base, VOLUNTEER_CONTACT: " 陣営の窓口 " }).volunteerContact).toBe(
      "陣営の窓口",
    );
  });
});

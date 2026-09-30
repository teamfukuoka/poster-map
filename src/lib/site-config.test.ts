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

  test("SOURCE_URL が https でなければ throw する", () => {
    expect(() => readSiteConfig({ ...base, SOURCE_URL: "http://example.jp" })).toThrow(
      "SOURCE_URL",
    );
  });
});

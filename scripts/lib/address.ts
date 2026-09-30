const KANJI_DIGITS: Record<string, number> = {
  〇: 0,
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
};

/** 「二十三」→ 23、「十一」→ 11、「百二」→ 102、「二〇」→ 20 */
function kanjiToNumber(value: string): number {
  let total = 0;
  let current = 0;
  for (const char of value) {
    if (char === "十") {
      total += (current || 1) * 10;
      current = 0;
    } else if (char === "百") {
      total += (current || 1) * 100;
      current = 0;
    } else {
      current = current * 10 + KANJI_DIGITS[char];
    }
  }
  return total + current;
}

/**
 * 住所を比較用に正規化する。
 * NFKC・空白の除去に加え、「一丁目8番1号」「1丁目8-1」「1-8-1」を同じ「1-8-1」に揃える。
 * 漢数字は「丁目」「番地」「番」「号」の直前だけを変換し、地名（五十川・六本松など）は変えない。
 * 長音の「ー」は数字に挟まれたときだけハイフンとみなす。
 */
export function normalizeAddress(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .replace(/[‐‑‒–—―−]/g, "-")
    .replace(/(\d)ー(?=\d)/g, "$1-")
    .replace(/[〇一二三四五六七八九十百]+(?=丁目|番地|番|号)/g, (kanji) =>
      String(kanjiToNumber(kanji)),
    )
    .replace(/(\d)(?:丁目|番地|番|号)/g, "$1-")
    .replace(/-{2,}/g, "-")
    .replace(/-+$/, "");
}

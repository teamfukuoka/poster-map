/** @jest-environment node */
import { normalizeAddress } from "./address";

test("丁目・番地・番・号の書き方の違いを揃える", () => {
  expect(normalizeAddress("早良区早良一丁目8番1号")).toBe("早良区早良1-8-1");
  expect(normalizeAddress("早良区早良1丁目8-1")).toBe("早良区早良1-8-1");
  expect(normalizeAddress("早良区早良1-8-1")).toBe("早良区早良1-8-1");
  expect(normalizeAddress("東区大字奈多1302番地")).toBe("東区大字奈多1302");
});

test("全角・空白を揃え、末尾のハイフンを除く", () => {
  expect(normalizeAddress("中央区天神 １丁目")).toBe("中央区天神1");
  expect(normalizeAddress("城南区別府四丁目７番")).toBe("城南区別府4-7");
});

test.each([
  ["十丁目", "10"],
  ["十一丁目", "11"],
  ["二十丁目", "20"],
  ["二十三番", "23"],
  ["九十九号", "99"],
])("漢数字 %s を算用数字 %s にする", (kanji, digits) => {
  expect(normalizeAddress(`中央区天神${kanji}`)).toBe(`中央区天神${digits}`);
});

test("地名の中の漢数字は変えない", () => {
  expect(normalizeAddress("博多区五十川一丁目")).toBe("博多区五十川1");
  expect(normalizeAddress("中央区六本松四丁目")).toBe("中央区六本松4");
  expect(normalizeAddress("東区千早二丁目")).toBe("東区千早2");
  expect(normalizeAddress("早良区百道浜")).toBe("早良区百道浜");
});

test.each([
  "1‐8‐1",
  "1‑8‑1",
  "1‒8‒1",
  "1–8–1",
  "1—8—1",
  "1―8―1",
  "1−8−1",
  "1ー8ー1",
  "１ｰ８ｰ１",
  "1－8－1",
])("ハイフン類 %s を - に揃える", (value) => {
  expect(normalizeAddress(`中央区天神${value}`)).toBe("中央区天神1-8-1");
});

test("長音の「ー」は数字に挟まれたときだけ - にする", () => {
  expect(normalizeAddress("西区姪浜センター1ー2")).toBe("西区姪浜センター1-2");
});

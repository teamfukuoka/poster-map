/** @jest-environment node */
import { geocodeGsi } from "./geocode-gsi";

function fakeFetch(features: unknown, status = 200) {
  const calls: string[] = [];
  const impl = (async (url: string) => {
    calls.push(url);
    return new Response(JSON.stringify(features), { status });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

const feature = (title: string, long: number, lat: number) => ({
  geometry: { coordinates: [long, lat] },
  properties: { title },
});

test("「福岡県福岡市」を付けて検索し、経度・緯度の順を入れ替えて返す", async () => {
  const { impl, calls } = fakeFetch([
    feature("福岡県福岡市早良区早良一丁目８番", 130.337219, 33.505627),
  ]);
  await expect(geocodeGsi("早良区早良一丁目8番1号", impl)).resolves.toEqual({
    lat: 33.505627,
    long: 130.337219,
    title: "福岡県福岡市早良区早良一丁目８番",
    precise: true,
  });
  expect(decodeURIComponent(calls[0])).toBe(
    "https://msearch.gsi.go.jp/address-search/AddressSearch?q=福岡県福岡市早良区早良一丁目8番1号",
  );
});

test("番地が見つからず町の代表点が返ったら precise: false", async () => {
  const { impl } = fakeFetch([feature("福岡県福岡市中央区天神", 130.3988, 33.5903)]);
  await expect(geocodeGsi("中央区天神九丁目99番", impl)).resolves.toEqual({
    lat: 33.5903,
    long: 130.3988,
    title: "福岡県福岡市中央区天神",
    precise: false,
  });
});

test.each([
  ["中央区天神1丁目2番", "福岡県福岡市中央区天神一丁目", true],
  ["早良区早良1-8-1", "福岡県福岡市早良区早良一丁目８番", true],
  ["中央区天神1丁目", "福岡県福岡市中央区天神十丁目", false],
  ["中央区天神10丁目", "福岡県福岡市中央区天神一丁目", false],
  ["西区今宿上ノ原", "福岡県福岡市西区今宿上ノ原", true],
  ["西区今宿上ノ原", "福岡県福岡市西区今宿", false],
])("%s → %s は precise: %s", async (address, title, precise) => {
  const { impl } = fakeFetch([feature(title, 130.4, 33.59)]);
  await expect(geocodeGsi(address, impl)).resolves.toMatchObject({ precise });
});

test("候補が複数あれば、丁目・番地まで一致したものを選ぶ", async () => {
  const { impl } = fakeFetch([
    feature("福岡県福岡市中央区天神", 130.3988, 33.5903),
    feature("福岡県福岡市中央区天神二丁目", 130.4, 33.591),
  ]);
  await expect(geocodeGsi("中央区天神2丁目5番", impl)).resolves.toMatchObject({
    title: "福岡県福岡市中央区天神二丁目",
    precise: true,
  });
});

test("市や区の代表点しか返らなければ見つからない扱い", async () => {
  const city = fakeFetch([feature("福岡県福岡市", 130.401672, 33.59)]);
  await expect(geocodeGsi("中央区存在しない町", city.impl)).resolves.toBeNull();
  const ward = fakeFetch([feature("福岡県福岡市中央区", 130.392822, 33.589203)]);
  await expect(geocodeGsi("中央区存在しない町", ward.impl)).resolves.toBeNull();
});

test("別の区の結果は採用しない", async () => {
  const { impl } = fakeFetch([feature("福岡県福岡市西区天神", 130.3, 33.6)]);
  await expect(geocodeGsi("中央区天神", impl)).resolves.toBeNull();
});

test("区で始まらない住所は問い合わせない", async () => {
  const { impl, calls } = fakeFetch([]);
  await expect(geocodeGsi("天神1丁目", impl)).resolves.toBeNull();
  expect(calls).toEqual([]);
});

test("HTTP エラーは例外", async () => {
  const { impl } = fakeFetch([], 503);
  await expect(geocodeGsi("中央区天神", impl)).rejects.toThrow("HTTP 503");
});

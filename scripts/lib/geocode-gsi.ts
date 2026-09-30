import { isInFukuokaCity, WARDS } from "../../src/features/poster-map/area";
import { normalizeAddress } from "./address";

export type GeocodeHit = {
  lat: number;
  long: number;
  title: string;
  /** false: 番地が見つからず、町・大字の代表点が返った（丁目・最初の番地の数字まで一致していない） */
  precise: boolean;
};

type GsiFeature = {
  geometry: { coordinates: [number, number] };
  properties: { title: string };
};

const ENDPOINT = "https://msearch.gsi.go.jp/address-search/AddressSearch?q=";
const CITY = "福岡県福岡市";

/**
 * 地理院の結果（title）が、入力住所の「丁目または最初の番地の数字」まで一致しているか。
 * 入力に数字がなければ、住所全体まで一致しているか。
 */
function isPrecise(title: string, address: string): boolean {
  const normalized = normalizeAddress(address);
  const key = normalized.match(/^\D*\d+/)?.[0] ?? normalized;
  const titleKey = normalizeAddress(title.startsWith(CITY) ? title.slice(CITY.length) : title);
  return titleKey.startsWith(key) && !/^\d/.test(titleKey.slice(key.length));
}

/**
 * 国土地理院の住所検索で座標を得る。
 * 住所が見つからないと市や区の代表点（「福岡県福岡市」「福岡県福岡市中央区」）が返るため、
 * 区より細かい地名まで一致した結果だけを採用する（それもなければ null）。
 * 番地が見つからないと町・大字の代表点（例: 「中央区天神九丁目99番」→「福岡県福岡市中央区天神」）が返る。
 * これも採用するが precise: false にする。候補が複数あれば precise のものを優先する。
 */
export async function geocodeGsi(
  address: string,
  fetchImpl: typeof fetch = fetch,
): Promise<GeocodeHit | null> {
  const ward = WARDS.find((w) => address.startsWith(w));
  if (!ward) return null;

  const response = await fetchImpl(`${ENDPOINT}${encodeURIComponent(`福岡県福岡市${address}`)}`);
  if (!response.ok) {
    throw new Error(`地理院の住所検索に失敗しました（HTTP ${response.status}）`);
  }
  const features = (await response.json()) as GsiFeature[];
  const prefix = `${CITY}${ward}`;
  const candidates = features.filter(
    (f) => f.properties.title.startsWith(prefix) && f.properties.title.length > prefix.length,
  );
  const hit = candidates.find((f) => isPrecise(f.properties.title, address)) ?? candidates[0];
  if (!hit) return null;

  const [long, lat] = hit.geometry.coordinates;
  if (!isInFukuokaCity(lat, long)) return null;
  return {
    lat,
    long,
    title: hit.properties.title,
    precise: isPrecise(hit.properties.title, address),
  };
}

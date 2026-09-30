import { isInFukuokaCity, WARDS } from "../../src/features/poster-map/area";

export type GeocodeHit = { lat: number; long: number; title: string };

type GsiFeature = {
  geometry: { coordinates: [number, number] };
  properties: { title: string };
};

const ENDPOINT = "https://msearch.gsi.go.jp/address-search/AddressSearch?q=";

/**
 * 国土地理院の住所検索で座標を得る。
 * 住所が見つからないと市や区の代表点（「福岡県福岡市」「福岡県福岡市中央区」）が返るため、
 * 区より細かい地名まで一致した結果だけを採用する。
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
  const prefix = `福岡県福岡市${ward}`;
  const hit = features.find(
    (f) => f.properties.title.startsWith(prefix) && f.properties.title.length > prefix.length,
  );
  if (!hit) return null;

  const [long, lat] = hit.geometry.coordinates;
  if (!isInFukuokaCity(lat, long)) return null;
  return { lat, long, title: hit.properties.title };
}

/** 福岡市の区（公式の順） */
export const WARDS = ["東区", "博多区", "中央区", "南区", "城南区", "早良区", "西区"] as const;

export const MAP_CENTER: [number, number] = [33.5902, 130.4017];
export const DEFAULT_ZOOM = 11;
export const MAX_ZOOM = 18;

/** 取り込み・ジオコーディングの結果を確かめるための範囲（福岡市全域を含む） */
export const FUKUOKA_BOUNDS = { minLat: 33.4, maxLat: 33.9, minLong: 130.0, maxLong: 130.55 };

export function isInFukuokaCity(lat: number, long: number): boolean {
  return (
    lat >= FUKUOKA_BOUNDS.minLat &&
    lat <= FUKUOKA_BOUNDS.maxLat &&
    long >= FUKUOKA_BOUNDS.minLong &&
    long <= FUKUOKA_BOUNDS.maxLong
  );
}

import {
  boardTooltipHtml,
  clusterIconHtml,
  clusterTooltipHtml,
  markerIconHtml,
  offsetPosition,
  pieSegmentsSvg,
} from "./marker-icons";
import { emptyStatusCounts } from "./stats";

function counts(partial: Partial<ReturnType<typeof emptyStatusCounts>>) {
  return { ...emptyStatusCounts(), ...partial };
}

test("markerIconHtml はステータスの色の丸を返す", () => {
  const html = markerIconHtml("done");
  expect(html).toContain("background-color: #10B981");
  expect(html).toContain("width: 20px");
});

test("1種類だけなら円グラフは塗りつぶしの円1つ", () => {
  const svg = pieSegmentsSvg(counts({ done: 3 }), 3, 35);
  expect(svg).toBe('<circle cx="17.5" cy="17.5" r="14.5" fill="#10B981" />');
});

test("複数なら完了から順に扇形を描く", () => {
  const svg = pieSegmentsSvg(counts({ not_yet: 1, done: 1 }), 2, 35);
  const strokes = [...svg.matchAll(/stroke="(#[0-9A-F]+)"/g)].map((m) => m[1]);
  expect(strokes).toEqual(["#10B981", "#6B7280"]);
  expect(svg).toContain('transform="rotate(-90 17.5 17.5)"');
  expect(svg).toContain('transform="rotate(90 17.5 17.5)"');
});

test.each([
  [9, 35],
  [10, 45],
  [99, 45],
  [100, 55],
])("クラスタの大きさ: %i件なら%ipx", (n, size) => {
  expect(clusterIconHtml(counts({ done: n })).size).toBe(size);
});

test("クラスタが1種類なら単色、複数なら円グラフ", () => {
  expect(clusterIconHtml(counts({ done: 5 })).html).not.toContain("<svg");
  expect(clusterIconHtml(counts({ done: 5, not_yet: 1 })).html).toContain("<svg");
  expect(clusterIconHtml(counts({ done: 5, not_yet: 1 })).html).toContain(">6</text>");
});

test("クラスタのツールチップは件数と短い表示名を並べる", () => {
  expect(clusterTooltipHtml(counts({ not_yet: 1, done: 2 }))).toBe(
    "掲示板数: 3<br>完了: 2<br>未貼付: 1",
  );
});

test("掲示板のツールチップは名称と住所をエスケープする", () => {
  const html = boardTooltipHtml({ number: "A-1", name: "<b>x</b>", address: "中央区&天神" }, 1);
  expect(html).toBe("#A-1 &lt;b&gt;x&lt;/b&gt;<br>中央区&amp;天神");
});

test("同じ位置に複数あるときはツールチップに件数を添える", () => {
  expect(boardTooltipHtml({ number: "A-1", name: "n", address: "a" }, 3)).toContain(
    "※この位置に3件の掲示板があります",
  );
});

test("offsetPosition は1件ならずらさない", () => {
  expect(offsetPosition(33.5, 130.4, 0, 1)).toEqual([33.5, 130.4]);
});

test("offsetPosition は複数なら円周上にずらす", () => {
  const [lat0, long0] = offsetPosition(33.5, 130.4, 0, 2);
  expect(lat0).toBeCloseTo(33.5001, 7);
  expect(long0).toBeCloseTo(130.4, 7);
  const [lat1, long1] = offsetPosition(33.5, 130.4, 1, 2);
  expect(lat1).toBeCloseTo(33.5 - 0.00015, 7);
  expect(long1).toBeCloseTo(130.4, 7);
});

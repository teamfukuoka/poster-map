/** @jest-environment node */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { blockingProblems, normalizeBoards } from "./normalize-boards";
import { parseCsv, readCsvFiles } from "./read-csv";

const HEADER = "prefecture,city,number,address,name,lat,long,note";

function rows(...lines: string[]) {
  return parseCsv([HEADER, ...lines].join("\n"));
}

describe("parseCsv", () => {
  test("BOM と前後の空白を取り除く", () => {
    expect(parseCsv("﻿number,name\n A-1 , 天神 \n")).toEqual([{ number: "A-1", name: "天神" }]);
  });
});

describe("normalizeBoards", () => {
  test("必要な列がなければ例外", () => {
    expect(() => normalizeBoards(parseCsv("number,name\nA-1,x\n"))).toThrow("address");
  });

  test("住所から区を取り出す", () => {
    const { boards } = normalizeBoards(
      rows("福岡県,福岡市,A-1,中央区天神1丁目,掲示板,33.59,130.40,"),
    );
    expect(boards).toEqual([
      {
        number: "A-1",
        name: "掲示板",
        address: "中央区天神1丁目",
        ward: "中央区",
        lat: 33.59,
        long: 130.4,
      },
    ]);
  });

  test("既定では、どれかの行が「削除」の番号を除く", () => {
    const result = normalizeBoards(
      rows(
        "福岡県,福岡市,A-1,東区三苫1丁目,掲示板,33.69,130.42,",
        "福岡県,福岡市,A-1,東区三苫1丁目,掲示板,,,削除",
      ),
    );
    expect(result.boards).toEqual([]);
    expect(result.removedNumbers).toEqual(["A-1"]);
  });

  test("includeRemoved なら「削除」の行だけを捨てる", () => {
    const result = normalizeBoards(
      rows(
        "福岡県,福岡市,A-1,東区三苫1丁目,掲示板,33.69,130.42,",
        "福岡県,福岡市,A-1,東区三苫1丁目,掲示板,,,削除",
        "福岡県,福岡市,A-2,東区三苫2丁目,掲示板,,,削除",
      ),
      { includeRemoved: true },
    );
    expect(result.boards.map((b) => b.number)).toEqual(["A-1"]);
    expect(result.removedNumbers).toEqual(["A-2"]);
  });

  test("重複は、座標あり → 区名が二重でない → 最後の行 の順で選び、食い違いを記録する", () => {
    const result = normalizeBoards(
      rows(
        "福岡県,福岡市,A-1,中央区天神1丁目,座標なし,,,",
        "福岡県,福岡市,A-1,中央区天神1丁目,正しい行,33.59,130.40,",
        "福岡県,福岡市,A-1,城南区中央区天神1丁目,二重の行,33.50,130.30,",
      ),
    );
    expect(result.boards).toEqual([
      {
        number: "A-1",
        name: "正しい行",
        address: "中央区天神1丁目",
        ward: "中央区",
        lat: 33.59,
        long: 130.4,
      },
    ]);
    expect(result.conflicts).toEqual(["A-1"]);
  });

  test("二重の区名しかなければ、先頭の区名を外して使う", () => {
    const { boards } = normalizeBoards(
      rows("福岡県,福岡市,A-1,城南区早良区次郎丸3丁目,x,33.58,130.35,"),
    );
    expect(boards[0]).toMatchObject({ address: "早良区次郎丸3丁目", ward: "早良区" });
  });

  test("取り込めない問題を集める", () => {
    const result = normalizeBoards(
      rows(
        "福岡県,福岡市,A-1,中央区天神1丁目,座標なし,,,",
        "福岡県,福岡市,A-2,中央区天神2丁目,範囲外,35.68,139.76,",
        "福岡県,福岡市,A-3,天神3丁目,区なし,33.59,130.40,",
        "福岡県,福岡市,A-4,中央区天神4丁目,要確認,33.59,130.40,要確認:座標なし",
        "福岡県,福岡市,A-5,中央区天神5丁目,メモ,33.59,130.40,手作業で修正",
      ),
    );
    expect(result.missingCoordinates).toEqual(["A-1"]);
    expect(result.outOfArea).toEqual(["A-2"]);
    expect(result.unknownWard).toEqual(["A-3"]);
    expect(result.notes).toEqual([
      { number: "A-4", note: "要確認:座標なし" },
      { number: "A-5", note: "手作業で修正" },
    ]);
    expect(blockingProblems(result)).toEqual([
      "座標がない: A-1",
      "福岡市の範囲外: A-2",
      "区が分からない: A-3",
      "要確認のメモが残っている: A-4",
    ]);
  });
});

describe("実データ（参院選 2025 の福岡市）", () => {
  const dir = join(__dirname, "../../data/sangin-2025");
  const files = readdirSync(dir)
    .filter((name) => name.endsWith(".csv"))
    .map((name) => join(dir, name));
  const data = readCsvFiles(files);

  function countByWard(boards: { ward: string }[]) {
    const counts: Record<string, number> = {};
    for (const b of boards) counts[b.ward] = (counts[b.ward] ?? 0) + 1;
    return counts;
  }

  test("既定では 1644 件で、取り込みを止める問題はない", () => {
    const result = normalizeBoards(data);
    expect(data).toHaveLength(2384);
    expect(result.boards).toHaveLength(1644);
    expect(result.removedNumbers).toHaveLength(185);
    expect(result.conflicts).toEqual(["有田第二-2", "有田第二-6", "田隈-5", "早良-7", "内野-7"]);
    expect(blockingProblems(result)).toEqual([]);
    expect(countByWard(result.boards)).toEqual({
      東区: 193,
      博多区: 238,
      中央区: 196,
      南区: 283,
      城南区: 154,
      早良区: 288,
      西区: 292,
    });
    expect(result.boards.find((b) => b.number === "早良-7")).toMatchObject({
      address: "早良区早良一丁目8番1号",
      lat: 33.5052703,
      long: 130.3373249,
    });
  });

  test("includeRemoved なら 1829 件（東区が 378 件）", () => {
    const result = normalizeBoards(data, { includeRemoved: true });
    expect(result.boards).toHaveLength(1829);
    expect(countByWard(result.boards).東区).toBe(378);
  });
});

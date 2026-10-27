/** @jest-environment node */
import { join } from "node:path";
import { missingAreaNumbers, parseBoardAreas } from "./board-areas";
import { normalizeBoards } from "./normalize-boards";
import { parseCsv, readCsvFiles } from "./read-csv";

const HEADER = "number,school,school_source,town,chome";

function rows(...lines: string[]) {
  return parseCsv([HEADER, ...lines].join("\n"));
}

describe("parseBoardAreas", () => {
  test("正しい 1 行を読む", () => {
    expect(parseBoardAreas(rows("馬出第一-1,馬出小,pdf,馬出,1"))).toEqual({
      areas: [
        { number: "馬出第一-1", school: "馬出小", schoolSource: "pdf", town: "馬出", chome: "1" },
      ],
      problems: [],
    });
  });

  test("chome が空なら null", () => {
    const { areas, problems } = parseBoardAreas(rows("A-1,志賀島小,map,大字志賀島,"));
    expect(problems).toEqual([]);
    expect(areas).toEqual([
      { number: "A-1", school: "志賀島小", schoolSource: "map", town: "大字志賀島", chome: null },
    ]);
  });

  test.each([
    ["school_source が pdf／map 以外", "A-1,馬出小,guess,馬出,1"],
    ["school が空", "A-1,,pdf,馬出,1"],
    ["town が空", "A-1,馬出小,pdf,,1"],
    ["chome が数字でない", "A-1,馬出小,pdf,馬出,一"],
  ])("%s なら、番号入りの問題を 1 行返す", (_label, line) => {
    const { areas, problems } = parseBoardAreas(rows(line));
    expect(areas).toEqual([]);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("A-1");
  });

  test("番号が重複したら、番号入りの問題を 1 行返す", () => {
    const { problems } = parseBoardAreas(
      rows("A-1,馬出小,pdf,馬出,1", "A-2,馬出小,pdf,馬出,1", "A-1,馬出小,pdf,馬出,2"),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("A-1");
  });

  test("必要な列がなければ例外", () => {
    expect(() => parseBoardAreas(parseCsv("number,school\nA-1,x\n"))).toThrow("school_source");
  });
});

describe("missingAreaNumbers", () => {
  const board = (number: string) => ({
    number,
    name: number,
    address: "中央区天神",
    ward: "中央区",
    lat: 33.59,
    long: 130.4,
  });

  test("表にない掲示板の番号を返す", () => {
    const { areas } = parseBoardAreas(rows("A-1,馬出小,pdf,馬出,1"));
    expect(missingAreaNumbers([board("A-1"), board("A-2")], areas)).toEqual(["A-2"]);
  });
});

describe("実データ（2026 年版）", () => {
  const dir = join(__dirname, "../../data/2026");

  test("全掲示場に校区・町名があり、表の問題もない", () => {
    const { boards } = normalizeBoards(readCsvFiles([join(dir, "boards.csv")]));
    const { areas, problems } = parseBoardAreas(readCsvFiles([join(dir, "board-areas.csv")]));
    expect(problems).toEqual([]);
    expect(missingAreaNumbers(boards, areas)).toEqual([]);
    expect(areas).toHaveLength(boards.length);
  });
});

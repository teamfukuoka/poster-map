/** @jest-environment node */
import { normalizeBoards } from "./normalize-boards";
import { parseCsv } from "./read-csv";
import { geocodePending, reconcile, toImportCsv, toReport, toSenkanRows } from "./reconcile";

const base = [
  { number: "A-1", address: "中央区天神1丁目", name: "a", ward: "中央区", lat: 33.59, long: 130.4 },
  {
    number: "A-2",
    address: "中央区天神2丁目",
    name: "b",
    ward: "中央区",
    lat: 33.591,
    long: 130.401,
  },
  {
    number: "A-3",
    address: "中央区天神3丁目",
    name: "c",
    ward: "中央区",
    lat: 33.592,
    long: 130.402,
  },
  {
    number: "A-4",
    address: "中央区天神4丁目",
    name: "d",
    ward: "中央区",
    lat: 33.593,
    long: 130.403,
  },
];

const senkan = [
  { number: "A-1", address: "中央区天神１丁目", name: "a" },
  { number: "A-2", address: "中央区大名1丁目", name: "b" },
  { number: "B-9", address: "中央区天神3丁目", name: "c" },
  { number: "C-1", address: "中央区赤坂1丁目", name: "e" },
];

test("変更なし・番号だけ変更・場所の変更・新規・なくなったもの を分ける", () => {
  const result = reconcile(senkan, base);
  expect(result.rows.map((r) => [r.kind, r.number, r.lat, r.note])).toEqual([
    ["unchanged", "A-1", 33.59, ""],
    ["moved", "A-2", null, ""],
    ["renumbered", "B-9", 33.592, "番号変更(旧:A-3)"],
    ["new", "C-1", null, ""],
  ]);
  expect(result.dropped.map((b) => b.number)).toEqual(["A-4"]);
});

test("場所の変更・新規だけをジオコーディングし、見つからなければ座標を空にする", async () => {
  const asked: string[] = [];
  const rows = await geocodePending(
    reconcile(senkan, base).rows,
    async (address) => {
      asked.push(address);
      return address.includes("大名")
        ? { lat: 33.589, long: 130.393, title: "福岡県福岡市中央区大名一丁目", precise: true }
        : null;
    },
    async () => {},
  );
  expect(asked).toEqual(["中央区大名1丁目", "中央区赤坂1丁目"]);
  expect(rows[1]).toMatchObject({
    lat: 33.589,
    note: "要確認:ジオコーディング(福岡県福岡市中央区大名一丁目) 旧住所:中央区天神2丁目 旧座標から774m",
  });
  expect(rows[3]).toMatchObject({ lat: null, long: null, note: "要確認:座標なし" });
});

test("場所が変わった掲示板は、ジオコーディングできなくても旧住所を note に残す", async () => {
  const rows = await geocodePending(
    reconcile(senkan, base).rows,
    async () => null,
    async () => {},
  );
  expect(rows[1].note).toBe("要確認:座標なし 旧住所:中央区天神2丁目");
  expect(rows[3].note).toBe("要確認:座標なし");
});

test("同じ住所に掲示板が複数あるときは、名称も一致する掲示板の座標を使う", () => {
  const school = "中央区春吉1丁目17番38号";
  const result = reconcile(
    [
      { number: "A-1", address: school, name: "東門横" },
      { number: "A-2", address: school, name: "正門横" },
    ],
    [
      { ...base[0], number: "A-1", address: school, name: "正門横", lat: 33.1, long: 130.1 },
      { ...base[1], number: "A-2", address: school, name: "東門横", lat: 33.2, long: 130.2 },
    ],
  );
  expect(result.rows.map((r) => [r.kind, r.number, r.lat, r.note])).toEqual([
    ["renumbered", "A-1", 33.2, "番号変更(旧:A-2)"],
    ["renumbered", "A-2", 33.1, "番号変更(旧:A-1)"],
  ]);
  expect(result.dropped).toEqual([]);
});

test("名称は全角・半角と空白の違いを無視して比べる", () => {
  const result = reconcile(
    [{ number: "B-1", address: "中央区天神1丁目", name: "九大東門横（あかり薬局前）" }],
    [{ ...base[0], name: "九大東門横 (あかり薬局前)" }],
  );
  expect(result.rows[0]).toMatchObject({ kind: "renumbered", note: "番号変更(旧:A-1)" });
});

test("2025 年版の誤字（日佐・千隈・七隅）は正しい地名と同じものとして扱う", () => {
  const result = reconcile(
    [
      { number: "曰佐-1", address: "南区曰佐二丁目1番", name: "曰佐中公園入口" },
      { number: "七隈-7", address: "城南区干隈二丁目13番", name: "七隈公園西側" },
    ],
    [
      { ...base[0], number: "日佐-29-1", address: "南区日佐二丁目1番", name: "日佐中公園入口" },
      { ...base[1], number: "七隅7", address: "城南区千隈二丁目13番", name: "七隅公園西側" },
    ],
  );
  expect(result.rows.map((r) => r.note)).toEqual(["番号変更(旧:日佐-29-1)", "番号変更(旧:七隅7)"]);
  expect(result.dropped).toEqual([]);
});

test("住所だけ一致して名称が違う掲示板は、番号変更として要確認にする", () => {
  const result = reconcile(
    [{ number: "B-1", address: "中央区天神1丁目", name: "公園北側" }],
    [{ ...base[0], name: "公園南側" }],
  );
  expect(result.rows[0]).toMatchObject({
    kind: "renumbered",
    lat: 33.59,
    note: "要確認:番号変更(旧:A-1 公園南側)",
  });
});

test("番号が同じで住所も同じなら、名称の書き換えは変更なしとして扱う", () => {
  const result = reconcile(
    [{ number: "A-1", address: "中央区天神1丁目", name: "a（新しい呼び方）" }],
    base,
  );
  expect(result.rows[0]).toMatchObject({ kind: "unchanged", lat: 33.59, note: "" });
});

test("住所の書き方の違い（漢数字・丁目・番・号・ハイフン）は同じ場所として扱う", () => {
  const result = reconcile(
    [
      { number: "A-1", address: "中央区天神1-8-1", name: "a" },
      { number: "B-9", address: "中央区天神2丁目3ー4", name: "b" },
    ],
    [
      { ...base[0], address: "中央区天神一丁目8番1号" },
      { ...base[1], number: "A-9", address: "中央区天神二丁目3番4号" },
    ],
  );
  expect(result.rows.map((r) => r.kind)).toEqual(["unchanged", "renumbered"]);
});

test("レポートの「場所が変わった掲示板」に旧住所と旧座標からの距離を出す", async () => {
  const rows = await geocodePending(
    reconcile(senkan, base).rows,
    async () => ({
      lat: 33.589,
      long: 130.393,
      title: "福岡県福岡市中央区大名一丁目",
      precise: true,
    }),
    async () => {},
  );
  const report = toReport({ rows, dropped: [] });
  expect(report).toContain("## 場所が変わった掲示板（1 件）");
  expect(report).toContain("- A-2 中央区大名1丁目（b）: 旧住所 中央区天神2丁目 / 旧座標から 774m");
  const notFound = toReport(reconcile(senkan, base));
  expect(notFound).toContain("- A-2 中央区大名1丁目（b）: 旧住所 中央区天神2丁目 / 座標なし");
});

test("町の代表点しか得られなかったら、note でそれと分かるようにする", async () => {
  const rows = await geocodePending(
    reconcile(senkan, base).rows,
    async () => ({ lat: 33.5885, long: 130.3935, title: "福岡県福岡市中央区大名", precise: false }),
    async () => {},
  );
  expect(rows[1].note).toMatch(
    /^要確認:町の代表点\(福岡県福岡市中央区大名\) 旧住所:中央区天神2丁目 旧座標から\d+m$/,
  );
  expect(rows[3].note).toBe("要確認:町の代表点(福岡県福岡市中央区大名)");
  expect(toReport({ rows, dropped: [] })).toContain("「町の代表点」は番地まで見つからず");
});

test("出力した CSV は取り込みの正規化で読め、要確認は取り込みを止める", async () => {
  const rows = await geocodePending(
    reconcile(senkan, base).rows,
    async () => null,
    async () => {},
  );
  const csv = toImportCsv(rows);
  // Excel で開いても文字化けしないよう BOM を付ける。読み込み側は BOM を除いて列名を読む
  expect(csv.split("\n")[0]).toBe("\uFEFFnumber,address,name,lat,long,note");
  expect(Object.keys(parseCsv(csv)[0])[0]).toBe("number");
  const result = normalizeBoards(parseCsv(csv));
  expect(result.missingCoordinates).toEqual(["A-2", "C-1"]);
  expect(result.notes.map((n) => n.number)).toEqual(["A-2", "B-9", "C-1"]);
});

test("カンマや引用符を含む値をクォートする", () => {
  const csv = toImportCsv([
    { kind: "new", number: "X", address: 'a,"b"', name: "n", lat: 1, long: 2, note: "" },
  ]);
  expect(csv).toBe('\uFEFFnumber,address,name,lat,long,note\nX,"a,""b""",n,1,2,\n');
});

test("レポートに件数と要確認・なくなったものを載せる", () => {
  const report = toReport(reconcile(senkan, base));
  expect(report).toContain("| 変更なし | 1 |");
  expect(report).toContain("| 2026 年版にない | 1 |");
  expect(report).toContain("## 要確認（0 件）");
  expect(report).toContain("- A-4 中央区天神4丁目（d）");
});

test("番号だけ変わった掲示板は、旧番号を引き継ぐ SQL をレポートに出す", () => {
  const result = reconcile(senkan, base);
  expect(result.rows[2].previous?.number).toBe("A-3");
  const report = toReport(result);
  expect(report).toContain("## 番号だけ変わった掲示板（1 件）");
  expect(report).toContain(
    "update public.poster_boards set number = '__renumber__' || 'B-9' where number = 'A-3';",
  );
  expect(report).toContain(
    "update public.poster_boards set number = substr(number, 13) where starts_with(number, '__renumber__');",
  );
  // SQL を実行しなかったときに旧番号も --prune で消えることを説明する
  expect(report).toMatch(/SQL を実行しなかった場合は.*A-3/);
});

test("引き継ぎの SQL は値を SQL の文字列としてエスケープする", () => {
  const result = reconcile(
    [{ number: "O'Brien-2", address: "中央区天神1丁目", name: "a" }],
    [{ ...base[0], number: "O'Brien-1" }],
  );
  expect(toReport(result)).toContain(
    "update public.poster_boards set number = '__renumber__' || 'O''Brien-2' where number = 'O''Brien-1';",
  );
});

test("新しい番号が 2026 年版にない掲示板の番号と同じなら、先にそちらを退ける SQL を出す", () => {
  const result = reconcile(
    [{ number: "A-2", address: "中央区天神3丁目", name: "c" }],
    [base[1], base[2]],
  );
  expect(result.dropped.map((board) => board.number)).toEqual(["A-2"]);
  const report = toReport(result);
  const evict = report.indexOf(
    "update public.poster_boards set number = '__dropped__' || number where number in ('A-2');",
  );
  const restore = report.indexOf("set number = substr(number, 13)");
  expect(evict).toBeGreaterThan(0);
  expect(evict).toBeLessThan(restore);
});

test("番号だけ変わった掲示板がなければ SQL を出さない", () => {
  const report = toReport(reconcile([senkan[0]], base));
  expect(report).toContain("## 番号だけ変わった掲示板（0 件）");
  expect(report).not.toContain("update public.poster_boards");
});

test("選管一覧の CSV を検査する", () => {
  expect(toSenkanRows(parseCsv("number,address,name,memo\nA-1, 中央区天神1丁目 ,a,x\n"))).toEqual([
    { number: "A-1", address: "中央区天神1丁目", name: "a" },
  ]);
  expect(() => toSenkanRows(parseCsv("number,name\nA-1,a\n"))).toThrow("address 列がありません");
  expect(() => toSenkanRows(parseCsv("number,address,name\nA-1,,a\n"))).toThrow("2 行目");
  expect(() => toSenkanRows(parseCsv("number,address,name\n,中央区天神1丁目,a\n"))).toThrow(
    "2 行目",
  );
  expect(() => toSenkanRows(parseCsv("number,address,name\n  ,中央区天神1丁目,a\n"))).toThrow(
    "2 行目",
  );
  expect(() => toSenkanRows(parseCsv("number,address,name\nA-1,x,a\nA-1,y,b\n"))).toThrow(
    "番号が重複しています: A-1",
  );
});

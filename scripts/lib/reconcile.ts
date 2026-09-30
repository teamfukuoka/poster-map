import type { GeocodeHit } from "./geocode-gsi";
import type { NormalizedBoard } from "./normalize-boards";
import type { CsvRow } from "./read-csv";

export type SenkanRow = { number: string; address: string; name: string };

export type ReconcileKind = "unchanged" | "renumbered" | "moved" | "new";

export type ReconcileRow = {
  kind: ReconcileKind;
  number: string;
  address: string;
  name: string;
  lat: number | null;
  long: number | null;
  note: string;
  /** renumbered・moved のとき、対応する 2025 年版の掲示板 */
  previous?: NormalizedBoard;
};

export type ReconcileResult = {
  rows: ReconcileRow[];
  /** 2025 年版にあって 2026 年版にない掲示板 */
  dropped: NormalizedBoard[];
};

/** 選管一覧の CSV（number,address,name）を検査して行にする */
export function toSenkanRows(rows: readonly CsvRow[]): SenkanRow[] {
  if (rows.length > 0) {
    for (const column of ["number", "address", "name"]) {
      if (!(column in rows[0])) {
        throw new Error(`選管一覧の CSV に ${column} 列がありません`);
      }
    }
  }
  const seen = new Set<string>();
  return rows.map((row, index) => {
    if (row.number === "" || row.address === "") {
      throw new Error(`選管一覧の ${index + 2} 行目: number と address は必須です`);
    }
    if (seen.has(row.number)) {
      throw new Error(`選管一覧で番号が重複しています: ${row.number}`);
    }
    seen.add(row.number);
    return { number: row.number, address: row.address, name: row.name };
  });
}

function sameAddress(a: string, b: string): boolean {
  const normalize = (value: string) => value.normalize("NFKC").replace(/\s+/g, "");
  return normalize(a) === normalize(b);
}

/** 2026 年の選管一覧（正本）と 2025 年版を照合する。座標は住所が一致するときだけ引き継ぐ */
export function reconcile(
  senkan: readonly SenkanRow[],
  base: readonly NormalizedBoard[],
): ReconcileResult {
  const baseByNumber = new Map(base.map((board) => [board.number, board]));
  const senkanNumbers = new Set(senkan.map((row) => row.number));
  const used = new Set<string>();
  const rows: ReconcileRow[] = [];

  for (const row of senkan) {
    const sameNumber = baseByNumber.get(row.number);
    if (sameNumber) {
      used.add(sameNumber.number);
      if (sameAddress(sameNumber.address, row.address)) {
        rows.push({
          kind: "unchanged",
          ...row,
          lat: sameNumber.lat,
          long: sameNumber.long,
          note: "",
        });
      } else {
        rows.push({
          kind: "moved",
          ...row,
          lat: null,
          long: null,
          note: "",
          previous: sameNumber,
        });
      }
      continue;
    }

    const renumbered = base.find(
      (board) =>
        !senkanNumbers.has(board.number) &&
        !used.has(board.number) &&
        sameAddress(board.address, row.address),
    );
    if (renumbered) {
      used.add(renumbered.number);
      rows.push({
        kind: "renumbered",
        ...row,
        lat: renumbered.lat,
        long: renumbered.long,
        note: `要確認:番号変更(旧:${renumbered.number})`,
        previous: renumbered,
      });
      continue;
    }

    rows.push({ kind: "new", ...row, lat: null, long: null, note: "" });
  }

  return { rows, dropped: base.filter((board) => !used.has(board.number)) };
}

/** 場所が変わったもの・新しいものに座標を付ける。見つからなければ座標を空にして取り込みで止まるようにする */
export async function geocodePending(
  rows: readonly ReconcileRow[],
  geocode: (address: string) => Promise<GeocodeHit | null>,
  wait: () => Promise<void>,
): Promise<ReconcileRow[]> {
  const result: ReconcileRow[] = [];
  for (const row of rows) {
    if (row.kind !== "moved" && row.kind !== "new") {
      result.push(row);
      continue;
    }
    const hit = await geocode(row.address);
    await wait();
    result.push(
      hit
        ? { ...row, lat: hit.lat, long: hit.long, note: `要確認:ジオコーディング(${hit.title})` }
        : { ...row, lat: null, long: null, note: "要確認:座標なし" },
    );
  }
  return result;
}

function csvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** pnpm import:boards にそのまま渡せる CSV */
export function toImportCsv(rows: readonly ReconcileRow[]): string {
  const lines = ["number,address,name,lat,long,note"];
  for (const row of rows) {
    lines.push(
      [
        row.number,
        row.address,
        row.name,
        row.lat?.toString() ?? "",
        row.long?.toString() ?? "",
        row.note,
      ]
        .map(csvField)
        .join(","),
    );
  }
  return `${lines.join("\n")}\n`;
}

function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

export function toReport(result: ReconcileResult): string {
  const count = (kind: ReconcileKind) => result.rows.filter((row) => row.kind === kind).length;
  const review = result.rows.filter((row) => row.note.startsWith("要確認"));
  const renumbered = result.rows.filter(
    (row): row is ReconcileRow & { previous: NormalizedBoard } =>
      row.kind === "renumbered" && row.previous !== undefined,
  );
  const renumberSql =
    renumbered.length === 0
      ? []
      : [
          "```sql",
          "begin;",
          ...renumbered.map(
            (row) =>
              `update public.poster_boards set number = ${sqlString(row.number)} where number = ${sqlString(row.previous.number)};`,
          ),
          "commit;",
          "```",
          "",
        ];
  const lines = [
    "# 掲示板の照合結果",
    "",
    "| 区分 | 件数 |",
    "|---|---|",
    `| 変更なし | ${count("unchanged")} |`,
    `| 番号だけ変更 | ${count("renumbered")} |`,
    `| 場所が変更 | ${count("moved")} |`,
    `| 新規 | ${count("new")} |`,
    `| 2026 年版にない | ${result.dropped.length} |`,
    "",
    `## 要確認（${review.length} 件）`,
    "",
    "地図で位置を確かめ、座標を直したら note を空にする。「座標なし」は lat,long を埋めるまで取り込めない。",
    "",
    ...review.map((row) => `- ${row.number} ${row.address}（${row.name}）: ${row.note}`),
    "",
    `## 番号だけ変わった掲示板（${renumbered.length} 件）`,
    "",
    "取り込み（pnpm import:boards）の**前に**、DB で次の SQL を実行すると、予約・報告の履歴を新しい番号に引き継げる。",
    "実行しないと、旧番号は DB に残り（--prune を付けると履歴ごと消える）、新しい番号は未貼付として追加される。",
    "",
    ...renumberSql,
    `## 2026 年版にない（${result.dropped.length} 件）`,
    "",
    "取り込み時に --prune を付けると DB から消える（予約・報告の履歴も消える）。",
    ...(renumbered.length === 0
      ? []
      : [
          `「番号だけ変わった掲示板」の SQL を実行しなかった場合は、その旧番号（${renumbered.map((row) => row.previous.number).join(", ")}）も DB に残っていて、同じく消える。`,
        ]),
    "",
    ...result.dropped.map((board) => `- ${board.number} ${board.address}（${board.name}）`),
    "",
  ];
  return lines.join("\n");
}

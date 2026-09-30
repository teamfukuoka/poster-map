import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { geocodeGsi } from "./lib/geocode-gsi";
import { normalizeBoards } from "./lib/normalize-boards";
import { parseCsv, readCsvFiles } from "./lib/read-csv";
import { geocodePending, reconcile, toImportCsv, toReport, toSenkanRows } from "./lib/reconcile";

const USAGE =
  "使い方: pnpm reconcile:boards --senkan <選管一覧.csv> --out <取り込み用.csv> --report <レポート.md> [--base data/sangin-2025]";
/** 地理院の API に負荷をかけないよう、1 件ごとに待つ */
const GEOCODE_INTERVAL_MS = 1000;

async function main() {
  const { values } = parseArgs({
    options: {
      senkan: { type: "string" },
      out: { type: "string" },
      report: { type: "string" },
      base: { type: "string", default: "data/sangin-2025" },
    },
  });
  if (!values.senkan || !values.out || !values.report) {
    console.error(USAGE);
    process.exit(2);
  }

  const baseFiles = readdirSync(values.base)
    .filter((file) => file.endsWith(".csv"))
    .map((file) => join(values.base as string, file));
  // 2025 年版で「削除」だった掲示板も、2026 年版にあれば座標を引き継げるように含める
  const base = normalizeBoards(readCsvFiles(baseFiles), { includeRemoved: true }).boards;
  const senkan = toSenkanRows(parseCsv(readFileSync(values.senkan, "utf8")));

  const result = reconcile(senkan, base);
  const pending = result.rows.filter((row) => row.kind === "moved" || row.kind === "new").length;
  console.log(
    `照合: 選管一覧 ${senkan.length} 件 / 2025 年版 ${base.length} 件。ジオコーディング ${pending} 件（約 ${pending} 秒）`,
  );

  const rows = await geocodePending(
    result.rows,
    (address) => geocodeGsi(address),
    () => new Promise((resolve) => setTimeout(resolve, GEOCODE_INTERVAL_MS)),
  );
  const finalResult = { rows, dropped: result.dropped };
  writeFileSync(values.out, toImportCsv(rows));
  writeFileSync(values.report, toReport(finalResult));
  console.log(`出力: ${values.out} / ${values.report}`);
  console.log(
    "レポートの「要確認」を地図で確かめ、note を空にしてから pnpm import:boards に渡してください。",
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

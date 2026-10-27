import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";
import { Client } from "pg";
import { type BoardArea, missingAreaNumbers, parseBoardAreas } from "./lib/board-areas";
import { importBoards, PruneNotConfirmedError } from "./lib/import-boards";
import { blockingProblems, type NormalizedBoard, normalizeBoards } from "./lib/normalize-boards";
import { readCsvFiles } from "./lib/read-csv";

const USAGE = [
  "使い方: pnpm import:boards [--dry-run] [--prune [--confirm-prune=<件数>]] [--include-removed] [--areas=<csv>] <csv>...",
  "  --dry-run: CSV を検査するだけで、DB には接続しない",
  "  --areas: 掲示場ごとの校区・町名の CSV（省略したら、最初の CSV と同じフォルダの board-areas.csv）。表にない番号があれば中止する",
  "  --prune: CSV にない掲示板を DB から消す（予約・報告の履歴も消える）。",
  "    消える掲示板があるときは、まず --confirm-prune なしで実行すると、DB を変えずに消える番号と履歴の件数を表示する。",
  "    確かめたら、表示された件数を --confirm-prune=<件数> に付けて実行し直す。",
].join("\n");

/** 校区・町名の表を読み、ファイルがない・問題がある・表にない番号があるときは中止（exit 1）する */
function readAreas(path: string, boards: readonly NormalizedBoard[]): BoardArea[] {
  if (!existsSync(path)) {
    console.error(`中止: 校区・町名の表がありません: ${path}（--areas=<csv> で指定できます）`);
    process.exit(1);
  }
  const { areas, problems } = parseBoardAreas(readCsvFiles([path]));
  if (problems.length > 0) {
    for (const problem of problems) {
      console.error(`中止: ${problem}`);
    }
    process.exit(1);
  }
  const missing = missingAreaNumbers(boards, areas);
  if (missing.length > 0) {
    console.error(`中止: 校区・町名の表にない番号: ${missing.join(", ")}`);
    process.exit(1);
  }
  return areas;
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      "dry-run": { type: "boolean", default: false },
      prune: { type: "boolean", default: false },
      "confirm-prune": { type: "string" },
      "include-removed": { type: "boolean", default: false },
      areas: { type: "string" },
    },
  });
  if (positionals.length === 0) {
    console.error(USAGE);
    process.exit(2);
  }
  let confirmPrune: number | undefined;
  if (values["confirm-prune"] !== undefined) {
    if (!values.prune || !/^\d+$/.test(values["confirm-prune"])) {
      console.error("--confirm-prune=<件数> は --prune と一緒に、0 以上の整数で指定してください");
      console.error(USAGE);
      process.exit(2);
    }
    confirmPrune = Number(values["confirm-prune"]);
  }

  const result = normalizeBoards(readCsvFiles(positionals), {
    includeRemoved: values["include-removed"],
  });
  const byWard = new Map<string, number>();
  for (const board of result.boards) {
    byWard.set(board.ward, (byWard.get(board.ward) ?? 0) + 1);
  }
  console.log(
    `掲示板 ${result.boards.length} 件（「削除」で除いた番号 ${result.removedNumbers.length} 件）`,
  );
  console.log([...byWard].map(([ward, count]) => `${ward} ${count}`).join(" / "));
  if (result.conflicts.length > 0) {
    console.log(`番号の重複（規則で 1 つに決めた）: ${result.conflicts.join(", ")}`);
  }

  if (result.boards.length === 0) {
    console.error("中止: 取り込む掲示板が 0 件です。CSV を確かめてください");
    process.exit(1);
  }
  const problems = blockingProblems(result);
  if (problems.length > 0) {
    for (const problem of problems) {
      console.error(`中止: ${problem}`);
    }
    process.exit(1);
  }
  const areas = readAreas(
    values.areas ?? join(dirname(positionals[0]), "board-areas.csv"),
    result.boards,
  );
  if (values["dry-run"]) {
    console.log("--dry-run のため DB は変更していません");
    return;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("環境変数 DATABASE_URL を設定してください");
  }
  const db = new Client({ connectionString });
  await db.connect();
  try {
    const summary = await importBoards(db, result.boards, {
      prune: values.prune,
      confirmPrune,
      areas,
    });
    console.log(
      `追加 ${summary.inserted} / 更新 ${summary.updated} / 変更なし ${summary.unchanged} / 削除 ${summary.deleted}`,
    );
  } catch (error) {
    if (!(error instanceof PruneNotConfirmedError)) throw error;
    const histories = error.targets.reduce((sum, t) => sum + t.historyCount, 0);
    console.error(
      `中止: --prune で次の ${error.targets.length} 件の掲示板が DB から消えます（予約・報告の履歴 計 ${histories} 件も消えます）。DB は変更していません。`,
    );
    for (const target of error.targets) {
      console.error(`- ${target.number}（履歴 ${target.historyCount} 件）`);
    }
    if (error.confirmPrune !== undefined) {
      console.error(
        `--confirm-prune=${error.confirmPrune} は、消える件数 ${error.targets.length} と一致しません。`,
      );
    }
    console.error(
      `消してよければ --confirm-prune=${error.targets.length} を付けて実行し直してください。`,
    );
    process.exitCode = 1;
  } finally {
    await db.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

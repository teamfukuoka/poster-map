import { parseArgs } from "node:util";
import { Client } from "pg";
import { importBoards } from "./lib/import-boards";
import { blockingProblems, normalizeBoards } from "./lib/normalize-boards";
import { readCsvFiles } from "./lib/read-csv";

const USAGE = "使い方: pnpm import:boards [--dry-run] [--prune] [--include-removed] <csv>...";

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      "dry-run": { type: "boolean", default: false },
      prune: { type: "boolean", default: false },
      "include-removed": { type: "boolean", default: false },
    },
  });
  if (positionals.length === 0) {
    console.error(USAGE);
    process.exit(2);
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

  const problems = blockingProblems(result);
  if (problems.length > 0) {
    for (const problem of problems) {
      console.error(`中止: ${problem}`);
    }
    process.exit(1);
  }
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
    const summary = await importBoards(db, result.boards, { prune: values.prune });
    console.log(
      `追加 ${summary.inserted} / 更新 ${summary.updated} / 変更なし ${summary.unchanged} / 削除 ${summary.deleted}`,
    );
  } finally {
    await db.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

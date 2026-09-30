import { readdirSync } from "node:fs";
import { join } from "node:path";
import { fetchAllBoards } from "@/features/poster-map/boards-query";
import { importBoards } from "../../scripts/lib/import-boards";
import { normalizeBoards } from "../../scripts/lib/normalize-boards";
import { readCsvFiles } from "../../scripts/lib/read-csv";
import { anonClient, resetDatabase, withPg } from "./helpers";

const board = (number: string, name = `掲示板${number}`) => ({
  number,
  name,
  address: `中央区天神${number}`,
  ward: "中央区",
  lat: 33.59,
  long: 130.4,
});

beforeEach(async () => {
  await resetDatabase();
});

test("新規・変更・変更なし・削除を数え、ステータスは保つ", async () => {
  await withPg(async (db) => {
    expect(await importBoards(db, [board("A-1"), board("A-2"), board("A-3")])).toEqual({
      inserted: 3,
      updated: 0,
      unchanged: 0,
      deleted: 0,
    });
    await db.query("update public.poster_boards set status = 'done' where number = 'A-1'");

    const summary = await importBoards(
      db,
      [board("A-1", "名前を変更"), board("A-2"), board("B-1")],
      {
        prune: true,
      },
    );
    expect(summary).toEqual({ inserted: 1, updated: 1, unchanged: 1, deleted: 1 });

    const rows = await db.query(
      "select number, name, status from public.poster_boards order by number",
    );
    expect(rows.rows).toEqual([
      { number: "A-1", name: "名前を変更", status: "done" },
      { number: "A-2", name: "掲示板A-2", status: "not_yet" },
      { number: "B-1", name: "掲示板B-1", status: "not_yet" },
    ]);
  });
});

test("prune なしでは一覧にない掲示板を残す", async () => {
  await withPg(async (db) => {
    await importBoards(db, [board("A-1"), board("A-2")]);
    const summary = await importBoards(db, [board("A-1")]);
    expect(summary.deleted).toBe(0);
    const count = await db.query("select count(*)::int as n from public.poster_boards");
    expect(count.rows[0].n).toBe(2);
  });
});

test("途中で失敗したら何も変えない", async () => {
  await withPg(async (db) => {
    await importBoards(db, [board("A-1")]);
    const broken = { ...board("A-2"), name: null as unknown as string };
    await expect(importBoards(db, [board("A-1", "変更"), broken])).rejects.toThrow();
    const rows = await db.query("select number, name from public.poster_boards");
    expect(rows.rows).toEqual([{ number: "A-1", name: "掲示板A-1" }]);
  });
});

test("実データ（2025 年版）を取り込み、1000 件を超えてもページングで全件読める", async () => {
  const dir = join(__dirname, "../../data/sangin-2025");
  const files = readdirSync(dir)
    .filter((name) => name.endsWith(".csv"))
    .map((name) => join(dir, name));
  const { boards } = normalizeBoards(readCsvFiles(files));
  await withPg(async (db) => {
    expect((await importBoards(db, boards)).inserted).toBe(1644);
    expect(await importBoards(db, boards)).toEqual({
      inserted: 0,
      updated: 0,
      unchanged: 1644,
      deleted: 0,
    });
  });
  expect(await fetchAllBoards(anonClient())).toHaveLength(1644);
});

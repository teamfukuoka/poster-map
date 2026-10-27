import { readdirSync } from "node:fs";
import { join } from "node:path";
import type { Client } from "pg";
import { fetchAllBoards } from "@/features/poster-map/boards-query";
import type { BoardArea } from "../../scripts/lib/board-areas";
import { importBoards, PruneNotConfirmedError } from "../../scripts/lib/import-boards";
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

const area = (number: string, school = "天神小"): BoardArea => ({
  number,
  school,
  schoolSource: "pdf",
  town: "天神",
  chome: "1",
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
      { prune: true, confirmPrune: 1 },
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

async function addHistory(number: string, times: number): Promise<void> {
  await withPg(async (db) => {
    for (let i = 0; i < times; i++) {
      await db.query(
        "insert into public.poster_board_status_history (board_id, display_name, previous_status, new_status) select id, 'テスト', 'not_yet', 'reserved' from public.poster_boards where number = $1",
        [number],
      );
    }
  });
}

async function snapshot(): Promise<unknown> {
  return withPg(async (db) => {
    const boards = await db.query(
      "select number, name, status from public.poster_boards order by number",
    );
    const history = await db.query(
      "select b.number, count(*)::int as n from public.poster_board_status_history h join public.poster_boards b on b.id = h.board_id group by b.number order by b.number",
    );
    return { boards: boards.rows, history: history.rows };
  });
}

describe("--prune の安全装置", () => {
  beforeEach(async () => {
    await withPg((db) => importBoards(db, [board("A-1"), board("A-2"), board("A-3")]));
    await addHistory("A-3", 2);
  });

  test.each([
    [{}],
    [{ prune: true }],
    [{ prune: true, confirmPrune: 3 }],
  ])("取り込む掲示板が 0 件なら中止し、DB を変えない（%o）", async (options) => {
    const before = await snapshot();
    await withPg(async (db) => {
      await expect(importBoards(db, [], options)).rejects.toThrow("取り込む掲示板が 0 件");
    });
    expect(await snapshot()).toEqual(before);
  });

  test("--confirm-prune なしなら DB を変えず、消える番号と履歴の件数を返す", async () => {
    const before = await snapshot();
    await withPg(async (db) => {
      const error = await importBoards(db, [board("A-1", "変更"), board("B-1")], {
        prune: true,
      }).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(PruneNotConfirmedError);
      expect((error as PruneNotConfirmedError).targets).toEqual([
        { number: "A-2", historyCount: 0 },
        { number: "A-3", historyCount: 2 },
      ]);
    });
    expect(await snapshot()).toEqual(before);
  });

  test("--confirm-prune の件数が違えば DB を変えない", async () => {
    const before = await snapshot();
    await withPg(async (db) => {
      await expect(
        importBoards(db, [board("A-1"), board("B-1")], { prune: true, confirmPrune: 1 }),
      ).rejects.toBeInstanceOf(PruneNotConfirmedError);
    });
    expect(await snapshot()).toEqual(before);
  });

  test("--confirm-prune の件数が合えば削除し、その履歴も消える", async () => {
    await withPg(async (db) => {
      expect(
        await importBoards(db, [board("A-1"), board("B-1")], { prune: true, confirmPrune: 2 }),
      ).toEqual({ inserted: 1, updated: 0, unchanged: 1, deleted: 2 });
    });
    expect(await snapshot()).toEqual({
      boards: [
        { number: "A-1", name: "掲示板A-1", status: "not_yet" },
        { number: "B-1", name: "掲示板B-1", status: "not_yet" },
      ],
      history: [],
    });
  });

  test("消える掲示板がなければ確認なしで進む", async () => {
    await withPg(async (db) => {
      expect(
        await importBoards(db, [board("A-1"), board("A-2"), board("A-3"), board("B-1")], {
          prune: true,
        }),
      ).toEqual({ inserted: 1, updated: 0, unchanged: 3, deleted: 0 });
    });
  });
});

describe("校区・町名の表（private.board_areas）", () => {
  const readAreas = (db: Client) =>
    db.query(
      "select number, school, school_source, town, chome from private.board_areas order by number",
    );

  test("areas を渡すと同じトランザクションで board_areas を書く", async () => {
    await withPg(async (db) => {
      await importBoards(db, [board("A-1"), board("A-2")], {
        areas: [area("A-1"), { ...area("A-2", "春吉小"), schoolSource: "map", chome: null }],
      });
      expect((await readAreas(db)).rows).toEqual([
        { number: "A-1", school: "天神小", school_source: "pdf", town: "天神", chome: "1" },
        { number: "A-2", school: "春吉小", school_source: "map", town: "天神", chome: null },
      ]);
    });
  });

  test("掲示板の取り込みに失敗したら、表も書かない", async () => {
    await withPg(async (db) => {
      const broken = { ...board("A-2"), name: null as unknown as string };
      await expect(
        importBoards(db, [board("A-1"), broken], { areas: [area("A-1"), area("A-2")] }),
      ).rejects.toThrow();
      expect((await readAreas(db)).rows).toEqual([]);
    });
  });

  test("取り込み直すと校区・町名を更新する", async () => {
    await withPg(async (db) => {
      await importBoards(db, [board("A-1")], { areas: [area("A-1")] });
      await importBoards(db, [board("A-1")], {
        areas: [{ ...area("A-1", "春吉小"), town: "春吉", chome: "2" }],
      });
      expect((await readAreas(db)).rows).toEqual([
        { number: "A-1", school: "春吉小", school_source: "pdf", town: "春吉", chome: "2" },
      ]);
    });
  });

  test("取り込む番号の分だけ書く（渡した areas にほかの番号があっても入れない）", async () => {
    await withPg(async (db) => {
      await importBoards(db, [board("A-1")], { areas: [area("A-1"), area("A-9")] });
      expect((await readAreas(db)).rows.map((r) => r.number)).toEqual(["A-1"]);
    });
  });

  test("番号の付け替えに表がついてくる", async () => {
    await withPg(async (db) => {
      await importBoards(db, [board("A-1")], { areas: [area("A-1")] });
      await db.query("update public.poster_boards set number = 'B-9' where number = 'A-1'");
      expect((await readAreas(db)).rows.map((r) => r.number)).toEqual(["B-9"]);
    });
  });

  test("prune で消えた掲示板の行は消える", async () => {
    await withPg(async (db) => {
      await importBoards(db, [board("A-1"), board("A-2")], { areas: [area("A-1"), area("A-2")] });
      await importBoards(db, [board("A-1")], {
        areas: [area("A-1")],
        prune: true,
        confirmPrune: 1,
      });
      expect((await readAreas(db)).rows.map((r) => r.number)).toEqual(["A-1"]);
    });
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

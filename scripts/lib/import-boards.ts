import type { Client } from "pg";
import type { NormalizedBoard } from "./normalize-boards";

export type ImportSummary = {
  inserted: number;
  updated: number;
  unchanged: number;
  deleted: number;
};

/** --prune で消える掲示板（履歴は掲示板の削除で一緒に消える） */
export type PruneTarget = { number: string; historyCount: number };

/** --prune で消える掲示板があり、confirmPrune の件数と一致しなかった（DB は変えていない） */
export class PruneNotConfirmedError extends Error {
  readonly targets: PruneTarget[];
  readonly confirmPrune: number | undefined;

  constructor(targets: PruneTarget[], confirmPrune: number | undefined) {
    super(
      `--prune で ${targets.length} 件の掲示板が消えます。件数を確かめて --confirm-prune=${targets.length} を付けてください`,
    );
    this.name = "PruneNotConfirmedError";
    this.targets = targets;
    this.confirmPrune = confirmPrune;
  }
}

/**
 * 掲示板を番号で upsert する。ステータスと履歴は保持する（名称・住所・区・座標だけを更新）。
 * 渡した掲示板が 0 件なら何もせず例外にする（空の CSV で全件を消さないため）。
 * prune: true なら、渡した一覧にない番号を削除する（その掲示板の履歴も消える）。
 * 消える掲示板があるときは、その件数と confirmPrune が一致するときだけ削除して commit する。
 * 一致しなければ rollback し、消える番号と履歴の件数を持つ PruneNotConfirmedError を投げる。
 */
export async function importBoards(
  db: Client,
  boards: readonly NormalizedBoard[],
  options: { prune?: boolean; confirmPrune?: number } = {},
): Promise<ImportSummary> {
  if (boards.length === 0) {
    throw new Error("取り込む掲示板が 0 件です。CSV を確かめてください（DB は変更していません）");
  }
  await db.query("begin");
  try {
    const upserted = await db.query<{ inserted: boolean }>(
      `insert into public.poster_boards (number, name, address, ward, lat, long)
       select * from unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::float8[], $6::float8[])
       on conflict (number) do update set
         name = excluded.name,
         address = excluded.address,
         ward = excluded.ward,
         lat = excluded.lat,
         long = excluded.long,
         updated_at = now()
       where (poster_boards.name, poster_boards.address, poster_boards.ward, poster_boards.lat, poster_boards.long)
         is distinct from (excluded.name, excluded.address, excluded.ward, excluded.lat, excluded.long)
       returning (xmax = 0) as inserted`,
      [
        boards.map((b) => b.number),
        boards.map((b) => b.name),
        boards.map((b) => b.address),
        boards.map((b) => b.ward),
        boards.map((b) => b.lat),
        boards.map((b) => b.long),
      ],
    );
    const inserted = upserted.rows.filter((row) => row.inserted).length;
    const updated = upserted.rows.length - inserted;

    let deleted = 0;
    if (options.prune) {
      const found = await db.query<{ number: string; history_count: number }>(
        `select b.number, count(h.id)::int as history_count
         from public.poster_boards b
         left join public.poster_board_status_history h on h.board_id = b.id
         where not (b.number = any($1::text[]))
         group by b.number
         order by b.number`,
        [boards.map((b) => b.number)],
      );
      const targets = found.rows.map((row) => ({
        number: row.number,
        historyCount: row.history_count,
      }));
      if (targets.length > 0 && options.confirmPrune !== targets.length) {
        throw new PruneNotConfirmedError(targets, options.confirmPrune);
      }
      if (targets.length > 0) {
        // 確かめた番号だけを消す（確認した件数と実際に消える件数を一致させる）
        const result = await db.query(
          "delete from public.poster_boards where number = any($1::text[])",
          [targets.map((t) => t.number)],
        );
        deleted = result.rowCount ?? 0;
      }
    }

    await db.query("commit");
    return { inserted, updated, unchanged: boards.length - inserted - updated, deleted };
  } catch (error) {
    await db.query("rollback");
    throw error;
  }
}

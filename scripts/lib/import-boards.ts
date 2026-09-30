import type { Client } from "pg";
import type { NormalizedBoard } from "./normalize-boards";

export type ImportSummary = {
  inserted: number;
  updated: number;
  unchanged: number;
  deleted: number;
};

/**
 * 掲示板を番号で upsert する。ステータスと履歴は保持する（名称・住所・区・座標だけを更新）。
 * prune: true なら、渡した一覧にない番号を削除する（その掲示板の履歴も消える）。
 */
export async function importBoards(
  db: Client,
  boards: readonly NormalizedBoard[],
  options: { prune?: boolean } = {},
): Promise<ImportSummary> {
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
      const result = await db.query(
        "delete from public.poster_boards where not (number = any($1::text[]))",
        [boards.map((b) => b.number)],
      );
      deleted = result.rowCount ?? 0;
    }

    await db.query("commit");
    return { inserted, updated, unchanged: boards.length - inserted - updated, deleted };
  } catch (error) {
    await db.query("rollback");
    throw error;
  }
}

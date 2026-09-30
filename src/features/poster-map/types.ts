import type { Database } from "@/lib/supabase/database.types";
import type { BoardStatus } from "./status";

type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

/** status.ts と DB の enum が食い違うと、ここで型エラーになる */
export const STATUS_ENUM_MATCHES_DB: Equals<
  BoardStatus,
  Database["public"]["Enums"]["poster_board_status"]
> = true;

export type MapBoard = {
  id: string;
  number: string;
  name: string;
  address: string;
  ward: string;
  lat: number;
  long: number;
  status: BoardStatus;
};

export type HistoryItem = {
  id: string;
  previousStatus: BoardStatus;
  newStatus: BoardStatus;
  displayName: string;
  note: string | null;
  createdAt: string;
};

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

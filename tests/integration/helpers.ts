import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Client } from "pg";
import type { Database } from "@/lib/supabase/database.types";

export type TestClient = SupabaseClient<Database>;

export const TEST_INVITE_CODE = "integration-test-code";

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} が未設定です。pnpm test:integration から実行してください。`);
  }
  return value;
}

export function anonClient(): TestClient {
  return createClient<Database>(
    requireEnv("SUPABASE_TEST_URL"),
    requireEnv("SUPABASE_TEST_ANON_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function signInAnon(): Promise<{ client: TestClient; userId: string }> {
  const client = anonClient();
  const { data, error } = await client.auth.signInAnonymously();
  if (error || !data.user) {
    throw error ?? new Error("匿名サインインに失敗しました");
  }
  return { client, userId: data.user.id };
}

export async function signInVolunteer(
  displayName: string,
): Promise<{ client: TestClient; userId: string }> {
  const signedIn = await signInAnon();
  const { error } = await signedIn.client.rpc("register_volunteer", {
    p_code: TEST_INVITE_CODE,
    p_display_name: displayName,
  });
  if (error) {
    throw error;
  }
  return signedIn;
}

export async function withPg<T>(fn: (db: Client) => Promise<T>): Promise<T> {
  const db = new Client({ connectionString: requireEnv("SUPABASE_TEST_DB_URL") });
  await db.connect();
  try {
    return await fn(db);
  } finally {
    await db.end();
  }
}

export async function resetDatabase(): Promise<void> {
  const url = requireEnv("SUPABASE_TEST_DB_URL");
  if (!/@(127\.0\.0\.1|localhost):/.test(url)) {
    throw new Error("resetDatabase はローカルの DB でしか実行できません");
  }
  await withPg(async (db) => {
    await db.query(
      "truncate public.poster_board_status_history, public.volunteers, public.poster_boards, private.invite_codes cascade",
    );
    await db.query("delete from auth.users");
    await db.query(
      "update private.site_settings set public_from = now() - interval '1 day', public_until = now() + interval '1 day', force_hidden = false",
    );
    await db.query(
      "insert into private.invite_codes (label, code_hash) values ('integration', extensions.crypt($1, extensions.gen_salt('bf')))",
      [TEST_INVITE_CODE],
    );
  });
}

export type PublicWindow = "open" | "before" | "after" | "hidden";

export async function setPublicWindow(mode: PublicWindow): Promise<void> {
  const sql: Record<PublicWindow, string> = {
    open: "public_from = now() - interval '1 day', public_until = now() + interval '1 day', force_hidden = false",
    before:
      "public_from = now() + interval '1 day', public_until = now() + interval '2 days', force_hidden = false",
    after:
      "public_from = now() - interval '2 days', public_until = now() - interval '1 day', force_hidden = false",
    hidden:
      "public_from = now() - interval '1 day', public_until = now() + interval '1 day', force_hidden = true",
  };
  await withPg((db) => db.query(`update private.site_settings set ${sql[mode]}`));
}

export async function insertBoard(
  number: string,
  status: Database["public"]["Enums"]["poster_board_status"] = "not_yet",
): Promise<string> {
  return withPg(async (db) => {
    const result = await db.query<{ id: string }>(
      "insert into public.poster_boards (number, name, address, ward, lat, long, status) values ($1, $2, $3, '中央区', 33.59, 130.40, $4) returning id",
      [number, `掲示板${number}`, `中央区天神${number}`, status],
    );
    return result.rows[0].id;
  });
}

export async function revokeInviteCodes(): Promise<void> {
  await withPg((db) => db.query("update private.invite_codes set revoked_at = now()"));
}

export async function revokeVolunteer(userId: string): Promise<void> {
  await withPg((db) =>
    db.query("update public.volunteers set revoked_at = now() where user_id = $1", [userId]),
  );
}

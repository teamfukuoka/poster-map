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
  const { data, error } = await signedIn.client.rpc("register_volunteer", {
    p_code: TEST_INVITE_CODE,
    p_display_name: displayName,
  });
  if (error) {
    throw error;
  }
  if (data?.error) {
    throw new Error(data.error);
  }
  return signedIn;
}

export type StaffRole = "admin" | "operator";

/** 管理画面の設定（テスト専用）。日時は SQL 式をそのまま埋める（例: "now() - interval '1 minute'"） */
export async function setAdminSettings(values: {
  allowedAmr?: string[];
  rehearsalResetUntil?: string;
  staleReservedAfter?: string;
}): Promise<void> {
  const sets: string[] = [];
  const params: unknown[] = [];
  if (values.allowedAmr) {
    params.push(values.allowedAmr);
    sets.push(`allowed_amr = $${params.length}::text[]`);
  }
  if (values.rehearsalResetUntil) {
    sets.push(`rehearsal_reset_until = ${values.rehearsalResetUntil}`);
  }
  if (values.staleReservedAfter) {
    sets.push(`stale_reserved_after = ${values.staleReservedAfter}`);
  }
  if (sets.length === 0) {
    return;
  }
  await withPg((db) => db.query(`update private.admin_settings set ${sets.join(", ")}`, params));
}

/**
 * メールとパスワードで作ったユーザーでログインする。role が null でなければ管理者の一覧に入れる。
 * テストではパスワードログイン（amr = password）を通す設定にしておく。
 */
export async function signInStaff(
  role: StaffRole | null,
  opts: { email?: string } = {},
): Promise<{ client: TestClient; userId: string; email: string }> {
  const email = opts.email ?? `staff-${crypto.randomUUID()}@example.invalid`;
  const client = anonClient();
  const { data, error } = await client.auth.signUp({
    email,
    password: `pw-${crypto.randomUUID()}`,
  });
  if (error || !data.user || !data.session) {
    throw error ?? new Error("メールでのサインアップに失敗しました");
  }
  if (role) {
    await withPg((db) =>
      db.query("insert into private.admin_members (email, role) values (lower($1), $2)", [
        email,
        role,
      ]),
    );
  }
  await setAdminSettings({ allowedAmr: ["oauth", "password"] });
  return { client, userId: data.user.id, email };
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
      "truncate public.poster_board_status_history, public.volunteers, public.poster_boards, private.invite_codes, private.invite_code_failures, private.admin_members, private.admin_audit_log cascade",
    );
    await db.query(
      "update private.admin_settings set allowed_amr = '{oauth}', rehearsal_reset_until = '2026-11-01 00:00:00+09', stale_reserved_after = '2026-11-01 14:00:00+09'",
    );
    await db.query("delete from auth.users");
    await db.query(
      "update private.site_settings set public_from = now() - interval '1 day', public_until = now() + interval '1 day', force_hidden = false, accepted_at = null",
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

/** 受理済み（accepted_at が入った）状態にする。false なら受理前に戻す。force_hidden は変えない */
export async function setAccepted(accepted: boolean): Promise<void> {
  await withPg((db) =>
    db.query(
      `update private.site_settings set accepted_at = ${accepted ? "now()" : "null"} where id`,
    ),
  );
}

export async function insertBoard(
  number: string,
  status: Database["public"]["Enums"]["poster_board_status"] = "not_yet",
  ward = "中央区",
): Promise<string> {
  return withPg(async (db) => {
    const result = await db.query<{ id: string }>(
      "insert into public.poster_boards (number, name, address, ward, lat, long, status) values ($1, $2, $3, $5, 33.59, 130.40, $4) returning id",
      [number, `掲示板${number}`, `${ward}天神${number}`, status, ward],
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

/** 参加コードの失敗の記録を、指定した日時で直接足す（上限の窓の外の記録を作るため） */
export async function insertInviteCodeFailures(
  userId: string,
  count: number,
  ago = "0 minutes",
): Promise<void> {
  await withPg((db) =>
    db.query(
      "insert into private.invite_code_failures (user_id, created_at) select $1, now() - $2::interval from generate_series(1, $3)",
      [userId, ago, count],
    ),
  );
}

export async function countInviteCodeFailures(userId?: string): Promise<number> {
  return withPg(async (db) => {
    const result = userId
      ? await db.query<{ n: string }>(
          "select count(*) as n from private.invite_code_failures where user_id = $1",
          [userId],
        )
      : await db.query<{ n: string }>("select count(*) as n from private.invite_code_failures");
    return Number(result.rows[0].n);
  });
}

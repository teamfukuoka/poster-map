import {
  insertBoard,
  resetDatabase,
  setAdminSettings,
  setPublicWindow,
  signInAnon,
  signInStaff,
  signInVolunteer,
  withPg,
} from "./helpers";

beforeEach(async () => {
  await resetDatabase();
});

// ---- 判定の土台（一覧・設定・記録） ----------------------------------------

describe("admin_whoami", () => {
  test("一覧の admin は admin", async () => {
    const { client } = await signInStaff("admin");
    expect((await client.rpc("admin_whoami")).data).toBe("admin");
  });

  test("一覧の operator は operator", async () => {
    const { client } = await signInStaff("operator");
    expect((await client.rpc("admin_whoami")).data).toBe("operator");
  });

  test("一覧にない email ユーザーは null", async () => {
    const { client } = await signInStaff(null);
    expect((await client.rpc("admin_whoami")).data).toBe(null);
  });

  test("匿名ユーザーは null", async () => {
    const { client } = await signInAnon();
    expect((await client.rpc("admin_whoami")).data).toBe(null);
  });

  test("ボランティアは null", async () => {
    const { client } = await signInVolunteer("a");
    expect((await client.rpc("admin_whoami")).data).toBe(null);
  });

  test("既定の allowed_amr（oauth だけ）ではパスワードログインは null", async () => {
    const { client } = await signInStaff("admin");
    await setAdminSettings({ allowedAmr: ["oauth"] });
    expect((await client.rpc("admin_whoami")).data).toBe(null);
  });

  test("大文字のメールでも一致する", async () => {
    const { client } = await signInStaff("operator", { email: "Staff-Upper@Example.invalid" });
    expect((await client.rpc("admin_whoami")).data).toBe("operator");
  });

  test("外した人は次の呼び出しから null", async () => {
    const { client, email } = await signInStaff("admin");
    await withPg((db) => db.query("delete from private.admin_members where email = $1", [email]));
    expect((await client.rpc("admin_whoami")).data).toBe(null);
  });
});

describe("admin_recent_audit_log", () => {
  test("一覧にない人は not_admin", async () => {
    const { client } = await signInStaff(null);
    expect((await client.rpc("admin_recent_audit_log")).error?.message).toBe("not_admin");
  });

  test("運営は読める・新しい順・100件まで", async () => {
    const { client } = await signInStaff("operator");
    await withPg((db) =>
      db.query(
        "insert into private.admin_audit_log (actor_email, action, target, created_at) select 'x@example.invalid', 'test', n::text, now() - (n || ' minutes')::interval from generate_series(1, 101) n",
      ),
    );
    const { data, error } = await client.rpc("admin_recent_audit_log");
    expect(error).toBeNull();
    expect(data).toHaveLength(100);
    const times = (data ?? []).map((row) => new Date(row.created_at).getTime());
    expect(times).toEqual([...times].sort((a, b) => b - a));
    expect(data?.[0].target).toBe("1");
  });
});

describe("private の管理テーブル", () => {
  test("anon / authenticated は直接読めない", async () => {
    const { client } = await signInStaff("admin");
    const { error } = await client
      .schema("private" as never)
      .from("admin_members")
      .select();
    expect(error).not.toBeNull();
  });
});

describe("private の関数", () => {
  test("anon / authenticated は実行できない", async () => {
    const rows = await withPg(async (db) => {
      const result = await db.query<{ signature: string; anon: boolean; authenticated: boolean }>(
        `select s as signature,
                has_function_privilege('anon', s, 'execute') as anon,
                has_function_privilege('authenticated', s, 'execute') as authenticated
         from unnest(array[
           'private.admin_role()',
           'private.require_admin_role(text)',
           'private.write_audit(text, text, text)'
         ]) s`,
      );
      return result.rows;
    });
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(row).toMatchObject({ anon: false, authenticated: false });
    }
  });

  test("管理テーブルは権限がなく、RLS が有効", async () => {
    const rows = await withPg(async (db) => {
      const result = await db.query<{ name: string; rls: boolean; granted: boolean }>(
        `select c.relname as name,
                c.relrowsecurity as rls,
                has_table_privilege('authenticated', c.oid, 'select') as granted
         from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'private' and c.relname like 'admin\\_%' and c.relkind = 'r'
         order by c.relname`,
      );
      return result.rows;
    });
    expect(rows.map((row) => row.name)).toEqual([
      "admin_audit_log",
      "admin_members",
      "admin_settings",
    ]);
    for (const row of rows) {
      expect(row).toMatchObject({ rls: true, granted: false });
    }
  });
});

// ---- 最初の画面 ---------------------------------------------------------------

/** 掲示場の updated_at を、いまから interval 前にずらす */
async function backdateBoard(boardId: string, ago: string): Promise<void> {
  await withPg((db) =>
    db.query("update public.poster_boards set updated_at = now() - $2::interval where id = $1", [
      boardId,
      ago,
    ]),
  );
}

/** 履歴を直接足す（new_status 以外の列は既定値） */
async function insertHistory(
  boardId: string,
  values: {
    userId?: string | null;
    displayName?: string;
    previous?: string;
    next: string;
    note?: string | null;
    ago?: string;
  },
): Promise<string> {
  return withPg(async (db) => {
    const result = await db.query<{ id: string }>(
      "insert into public.poster_board_status_history (board_id, user_id, display_name, previous_status, new_status, note, created_at) values ($1, $2, $3, $4::public.poster_board_status, $5::public.poster_board_status, $6, now() - $7::interval) returning id",
      [
        boardId,
        values.userId ?? null,
        values.displayName ?? "たろう",
        values.previous ?? "not_yet",
        values.next,
        values.note ?? null,
        values.ago ?? "0 minutes",
      ],
    );
    return result.rows[0].id;
  });
}

describe("最初の画面", () => {
  test("どれも一覧にない人は not_admin", async () => {
    const { client: outsider } = await signInStaff(null);
    for (const fn of [
      "admin_stale_reservations",
      "admin_dangerous_boards",
      "admin_recent_reports",
      "admin_ward_progress",
      "admin_site_state",
    ] as const) {
      expect((await outsider.rpc(fn)).error?.message).toBe("not_admin");
    }
  });

  test("長い予約: 起点より前は空", async () => {
    const { client } = await signInStaff("operator");
    const id = await insertBoard("A-1", "reserved");
    await backdateBoard(id, "7 hours");
    await setAdminSettings({ staleReservedAfter: "now() + interval '1 hour'" });
    const { data, error } = await client.rpc("admin_stale_reservations");
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  test("長い予約: 起点の後で6時間以上なら出る・6時間未満は出ない", async () => {
    const { client } = await signInStaff("operator");
    const a = await insertBoard("A-1", "reserved");
    const b = await insertBoard("B-1", "reserved");
    const c = await insertBoard("C-1", "not_yet");
    await backdateBoard(a, "7 hours");
    await backdateBoard(b, "5 hours");
    await backdateBoard(c, "7 hours");
    await setAdminSettings({ staleReservedAfter: "now() - interval '1 hour'" });
    const { data, error } = await client.rpc("admin_stale_reservations");
    expect(error).toBeNull();
    expect(data?.map((r) => r.number)).toEqual(["A-1"]);
    expect(data?.[0]).toMatchObject({ board_id: a, ward: "中央区", name: "掲示板A-1" });
  });

  test("長い予約: 古い順", async () => {
    const { client } = await signInStaff("operator");
    const a = await insertBoard("A-1", "reserved");
    const b = await insertBoard("B-1", "reserved");
    await backdateBoard(a, "7 hours");
    await backdateBoard(b, "9 hours");
    await setAdminSettings({ staleReservedAfter: "now() - interval '1 hour'" });
    const { data } = await client.rpc("admin_stale_reservations");
    expect(data?.map((r) => r.number)).toEqual(["B-1", "A-1"]);
  });

  test("長い予約: 予約した人は最新の reserved の履歴のニックネーム", async () => {
    const { client } = await signInStaff("operator");
    const volunteer = await signInVolunteer("たろう");
    const id = await insertBoard("A-1", "not_yet");
    const updated = await volunteer.client.rpc("update_board_status", {
      p_board_id: id,
      p_status: "reserved",
    });
    expect(updated.error).toBeNull();
    await backdateBoard(id, "7 hours");
    await setAdminSettings({ staleReservedAfter: "now() - interval '1 hour'" });
    const { data } = await client.rpc("admin_stale_reservations");
    expect(data).toHaveLength(1);
    expect(data?.[0].reserved_by).toBe("たろう");
    expect(data?.[0].reserved_at).toBeTruthy();
  });

  test("長い予約: 履歴がなければ予約した人は null", async () => {
    const { client } = await signInStaff("operator");
    const id = await insertBoard("A-1", "reserved");
    await backdateBoard(id, "7 hours");
    await setAdminSettings({ staleReservedAfter: "now() - interval '1 hour'" });
    const { data } = await client.rpc("admin_stale_reservations");
    expect(data?.[0].reserved_by).toBeNull();
  });

  test("危険: not_yet_dangerous の掲示場と最新の報告", async () => {
    const { client } = await signInStaff("operator");
    const a = await insertBoard("A-1", "not_yet_dangerous");
    const b = await insertBoard("B-1", "not_yet_dangerous");
    await insertBoard("C-1", "not_yet");
    await insertHistory(a, {
      next: "not_yet_dangerous",
      displayName: "古い人",
      note: "古い報告",
      ago: "3 hours",
    });
    await insertHistory(a, {
      next: "not_yet_dangerous",
      displayName: "はなこ",
      note: "交差点の角",
      ago: "2 hours",
    });
    await insertHistory(b, { next: "not_yet_dangerous", displayName: "じろう", ago: "1 hour" });
    const { data, error } = await client.rpc("admin_dangerous_boards");
    expect(error).toBeNull();
    expect(data?.map((r) => r.number)).toEqual(["B-1", "A-1"]);
    expect(data?.[0]).toMatchObject({ board_id: b, reported_by: "じろう", note: null });
    expect(data?.[1]).toMatchObject({
      board_id: a,
      reported_by: "はなこ",
      note: "交差点の角",
    });
  });

  test("新しい連絡事項: 24時間以内の連絡事項つき・他候補・その他だけ", async () => {
    const { client } = await signInStaff("operator");
    const { userId } = await signInVolunteer("たろう");
    const id = await insertBoard("A-1", "done");
    const withNote = await insertHistory(id, {
      userId,
      next: "done",
      previous: "reserved",
      note: "インクがかすれています",
      ago: "1 hour",
    });
    await insertHistory(id, { next: "done", previous: "reserved", ago: "2 hours" });
    const other = await insertHistory(id, { next: "other", ago: "3 hours" });
    const wrongPoster = await insertHistory(id, {
      next: "error_wrong_poster",
      ago: "30 minutes",
    });
    await insertHistory(id, { next: "done", note: "昨日の連絡", ago: "25 hours" });
    const { data, error } = await client.rpc("admin_recent_reports");
    expect(error).toBeNull();
    expect(data?.map((r) => r.history_id)).toEqual([wrongPoster, withNote, other]);
    expect(data?.[1]).toMatchObject({
      board_id: id,
      number: "A-1",
      ward: "中央区",
      user_id: userId,
      display_name: "たろう",
      previous_status: "reserved",
      new_status: "done",
      note: "インクがかすれています",
    });
  });

  test("区ごとの進み具合: 全数・完了・予約", async () => {
    const { client } = await signInStaff("operator");
    await insertBoard("A-1", "done");
    await insertBoard("A-2", "reserved");
    await insertBoard("A-3", "not_yet");
    await insertBoard("B-1", "done", "博多区");
    await insertBoard("B-2", "done", "博多区");
    const { data, error } = await client.rpc("admin_ward_progress");
    expect(error).toBeNull();
    expect(data).toContainEqual({ ward: "中央区", total: 3, done: 1, reserved: 1 });
    expect(data).toContainEqual({ ward: "博多区", total: 2, done: 2, reserved: 0 });
  });

  test("公開の状態: 公開中", async () => {
    const { client } = await signInStaff("operator");
    const { data, error } = await client.rpc("admin_site_state");
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data?.[0]).toMatchObject({ force_hidden: false, is_public: true });
    expect(data?.[0].public_from).toBeTruthy();
    expect(data?.[0].public_until).toBeTruthy();
    expect(new Date(data?.[0].rehearsal_reset_until ?? "").toISOString()).toBe(
      "2026-10-31T15:00:00.000Z",
    );
  });

  test("公開の状態: hidden なら force_hidden true・is_public false", async () => {
    const { client } = await signInStaff("operator");
    await setPublicWindow("hidden");
    const { data } = await client.rpc("admin_site_state");
    expect(data?.[0]).toMatchObject({ force_hidden: true, is_public: false });
  });

  test("公開の状態: 期間の前は is_public false", async () => {
    const { client } = await signInStaff("operator");
    await setPublicWindow("before");
    const { data } = await client.rpc("admin_site_state");
    expect(data?.[0]).toMatchObject({ force_hidden: false, is_public: false });
  });
});

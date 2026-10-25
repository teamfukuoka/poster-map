import {
  getAdminRole,
  loadAuditLog,
  loadDashboard,
  loadInviteCodes,
  registerInviteCode,
  resetRehearsal,
  revealInviteCode,
  revokeInviteCode,
  setForceHidden,
} from "@/features/admin/admin-service";
import { joinAsVolunteer } from "@/features/poster-map/volunteer-service";
import {
  anonClient,
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

// ---- 公開の切り替え・リハーサルのまとめ戻し（管理者だけ） ------------------

async function auditRows(action: string) {
  return withPg(async (db) => {
    const result = await db.query<{ actor_email: string; target: string | null }>(
      "select actor_email, target from private.admin_audit_log where action = $1 order by id",
      [action],
    );
    return result.rows;
  });
}

describe("admin_set_force_hidden", () => {
  test("operator は forbidden・変わらない", async () => {
    const { client } = await signInStaff("operator");
    const { error } = await client.rpc("admin_set_force_hidden", { p_hidden: true });
    expect(error?.message).toBe("forbidden");
    expect((await client.rpc("admin_site_state")).data?.[0].force_hidden).toBe(false);
    expect(await auditRows("set_force_hidden")).toEqual([]);
  });

  test("一覧にない人は not_admin", async () => {
    const { client } = await signInStaff(null);
    const { error } = await client.rpc("admin_set_force_hidden", { p_hidden: true });
    expect(error?.message).toBe("not_admin");
  });

  test("admin は止めて再開できる・記録が残る", async () => {
    const { client, email } = await signInStaff("admin");
    expect((await client.rpc("admin_set_force_hidden", { p_hidden: true })).error).toBeNull();
    let state = (await client.rpc("admin_site_state")).data?.[0];
    expect(state).toMatchObject({ force_hidden: true, is_public: false });
    expect((await client.rpc("admin_set_force_hidden", { p_hidden: false })).error).toBeNull();
    state = (await client.rpc("admin_site_state")).data?.[0];
    expect(state).toMatchObject({ force_hidden: false, is_public: true });
    expect(await auditRows("set_force_hidden")).toEqual([
      { actor_email: email.toLowerCase(), target: "true" },
      { actor_email: email.toLowerCase(), target: "false" },
    ]);
  });
});

describe("admin_reset_rehearsal", () => {
  // 締切を現在時刻からの相対にする（実際の日付が既定の締切を過ぎても結果が変わらないように）
  async function openResetWindow() {
    await setAdminSettings({ rehearsalResetUntil: "now() + interval '1 day'" });
  }

  async function seedRehearsal() {
    await openResetWindow();
    const id = await insertBoard("A-1", "done");
    const other = await insertBoard("A-2", "reserved");
    await insertHistory(id, { previous: "not_yet", next: "reserved" });
    await insertHistory(id, { previous: "reserved", next: "done" });
    return { id, other };
  }

  async function snapshot() {
    return withPg(async (db) => {
      const history = await db.query<{ n: string }>(
        "select count(*) as n from public.poster_board_status_history",
      );
      const boards = await db.query<{ number: string; status: string }>(
        "select number, status from public.poster_boards order by number",
      );
      return { history: Number(history.rows[0].n), boards: boards.rows };
    });
  }

  test("operator は forbidden・履歴は残る", async () => {
    const { client } = await signInStaff("operator");
    await seedRehearsal();
    const { error } = await client.rpc("admin_reset_rehearsal", { p_confirm: "リセット" });
    expect(error?.message).toBe("forbidden");
    expect((await snapshot()).history).toBe(2);
    expect(await auditRows("reset_rehearsal")).toEqual([]);
  });

  test("確認の文字が違えば confirm_mismatch・何も変わらない", async () => {
    const { client } = await signInStaff("admin");
    await seedRehearsal();
    for (const p_confirm of ["", "reset", "リセット "]) {
      const { error } = await client.rpc("admin_reset_rehearsal", { p_confirm });
      expect(error?.message).toBe("confirm_mismatch");
    }
    expect(await snapshot()).toEqual({
      history: 2,
      boards: [
        { number: "A-1", status: "done" },
        { number: "A-2", status: "reserved" },
      ],
    });
    expect(await auditRows("reset_rehearsal")).toEqual([]);
  });

  test("締切の前なら履歴を消して全掲示場を not_yet に戻す", async () => {
    const { client, email } = await signInStaff("admin");
    await seedRehearsal();
    const { error } = await client.rpc("admin_reset_rehearsal", { p_confirm: "リセット" });
    expect(error).toBeNull();
    expect(await snapshot()).toEqual({
      history: 0,
      boards: [
        { number: "A-1", status: "not_yet" },
        { number: "A-2", status: "not_yet" },
      ],
    });
    expect(await auditRows("reset_rehearsal")).toEqual([
      { actor_email: email.toLowerCase(), target: "2" },
    ]);
  });

  test("締切を過ぎたら reset_closed・確認の文字が正しくても何も変わらない", async () => {
    const { client } = await signInStaff("admin");
    await seedRehearsal();
    await setAdminSettings({ rehearsalResetUntil: "now() - interval '1 minute'" });
    const { error } = await client.rpc("admin_reset_rehearsal", { p_confirm: "リセット" });
    expect(error?.message).toBe("reset_closed");
    expect((await snapshot()).history).toBe(2);
    expect(await auditRows("reset_rehearsal")).toEqual([]);
  });

  test("締切を過ぎたら、確認の文字が違っても reset_closed（締切の判定が先）", async () => {
    const { client } = await signInStaff("admin");
    await setAdminSettings({ rehearsalResetUntil: "now() - interval '1 minute'" });
    const { error } = await client.rpc("admin_reset_rehearsal", { p_confirm: "違う" });
    expect(error?.message).toBe("reset_closed");
  });

  test("既定の締切は 2026-11-01 00:00 JST", async () => {
    const { client } = await signInStaff("admin");
    const state = (await client.rpc("admin_site_state")).data?.[0];
    expect(new Date(state?.rehearsal_reset_until ?? "").toISOString()).toBe(
      "2026-10-31T15:00:00.000Z",
    );
  });
});

// ---- 参加コードの登録・表示・失効・人数 --------------------------------------

const CODE = "test-code-2345"; // 英字・数字・記号入り（テスト専用の値）
const CODE_B = "other-Code-6789";

async function joinWith(code: string, name = "a") {
  const v = await signInAnon();
  const result = await v.client.rpc("register_volunteer", { p_code: code, p_display_name: name });
  return { ...v, result };
}

async function inviteCodeId(label: string): Promise<string> {
  return withPg(async (db) => {
    const r = await db.query<{ id: string }>(
      "select id from private.invite_codes where label = $1 order by created_at desc limit 1",
      [label],
    );
    return r.rows[0].id;
  });
}

describe("参加コード", () => {
  test("operator は登録・失効が forbidden・一覧と表示はできる", async () => {
    const { client: admin } = await signInStaff("admin");
    const id = (await admin.rpc("admin_register_invite_code", { p_label: "東区", p_code: CODE }))
      .data as string;
    const { client } = await signInStaff("operator");
    expect(
      (await client.rpc("admin_register_invite_code", { p_label: "x", p_code: CODE_B })).error
        ?.message,
    ).toBe("forbidden");
    expect(
      (await client.rpc("admin_revoke_invite_code", { p_id: id, p_revoke_volunteers: false })).error
        ?.message,
    ).toBe("forbidden");
    expect((await client.rpc("admin_list_invite_codes")).error).toBeNull();
    expect((await client.rpc("admin_reveal_invite_code", { p_id: id })).data).toBe(CODE);
  });

  test("一覧にない人は not_admin", async () => {
    const { client } = await signInStaff(null);
    expect((await client.rpc("admin_list_invite_codes")).error?.message).toBe("not_admin");
    expect(
      (await client.rpc("admin_reveal_invite_code", { p_id: crypto.randomUUID() })).error?.message,
    ).toBe("not_admin");
    expect(
      (await client.rpc("admin_register_invite_code", { p_label: "x", p_code: CODE })).error
        ?.message,
    ).toBe("not_admin");
    expect(
      (
        await client.rpc("admin_revoke_invite_code", {
          p_id: crypto.randomUUID(),
          p_revoke_volunteers: false,
        })
      ).error?.message,
    ).toBe("not_admin");
  });

  test("登録したコードで参加できる・code_plain に入り audit には残らない", async () => {
    const { client: admin, email } = await signInStaff("admin");
    const { error } = await admin.rpc("admin_register_invite_code", {
      p_label: "東区リーダー配布",
      p_code: CODE,
    });
    expect(error).toBeNull();
    expect((await joinWith(CODE)).result.data?.error).toBeFalsy();
    const plain = await withPg((db) =>
      db.query<{ code_plain: string }>(
        "select code_plain from private.invite_codes where label = '東区リーダー配布'",
      ),
    );
    expect(plain.rows[0].code_plain).toBe(CODE);
    const audit = await withPg((db) =>
      db.query<{ j: string }>("select row_to_json(a)::text as j from private.admin_audit_log a"),
    );
    expect(audit.rows.map((r) => r.j).join()).not.toContain(CODE);
    expect(await auditRows("register_invite_code")).toEqual([
      { actor_email: email.toLowerCase(), target: "東区リーダー配布" },
    ]);
  });

  test("表示で登録した値が返り、記録に reveal_invite_code と label が残る（コードは残らない）", async () => {
    const { client: admin, email } = await signInStaff("admin");
    const id = (await admin.rpc("admin_register_invite_code", { p_label: "南区", p_code: CODE }))
      .data as string;
    const { data, error } = await admin.rpc("admin_reveal_invite_code", { p_id: id });
    expect(error).toBeNull();
    expect(data).toBe(CODE);
    expect(await auditRows("reveal_invite_code")).toEqual([
      { actor_email: email.toLowerCase(), target: "南区" },
    ]);
    const audit = await withPg((db) =>
      db.query<{ j: string }>("select row_to_json(a)::text as j from private.admin_audit_log a"),
    );
    expect(audit.rows.map((r) => r.j).join()).not.toContain(CODE);
  });

  test("表示は存在しない id なら invite_code_not_found・失効済みも返す", async () => {
    const { client: admin } = await signInStaff("admin");
    expect(
      (await admin.rpc("admin_reveal_invite_code", { p_id: crypto.randomUUID() })).error?.message,
    ).toBe("invite_code_not_found");
    const id = (await admin.rpc("admin_register_invite_code", { p_label: "南区", p_code: CODE }))
      .data as string;
    await admin.rpc("admin_revoke_invite_code", { p_id: id, p_revoke_volunteers: false });
    expect((await admin.rpc("admin_reveal_invite_code", { p_id: id })).data).toBe(CODE);
  });

  test("平文のない以前のコード（seed の local-dev-code の code_plain を null にした行）は has_code=false・表示は null", async () => {
    const { client: admin } = await signInStaff("admin");
    await withPg((db) =>
      db.query(
        "insert into private.invite_codes (label, code_hash, code_plain) values ('local-dev', extensions.crypt('local-dev-code', extensions.gen_salt('bf')), 'local-dev-code')",
      ),
    );
    await withPg((db) =>
      db.query("update private.invite_codes set code_plain = null where label = 'local-dev'"),
    );
    const { data } = await admin.rpc("admin_list_invite_codes");
    const legacy = data?.find((r) => r.label === "local-dev");
    expect(legacy?.has_code).toBe(false);
    const id = await inviteCodeId("local-dev");
    const revealed = await admin.rpc("admin_reveal_invite_code", { p_id: id });
    expect(revealed.error).toBeNull();
    expect(revealed.data).toBeNull();
  });

  test("登録で前後の空白は落とす", async () => {
    const { client: admin } = await signInStaff("admin");
    const id = (
      await admin.rpc("admin_register_invite_code", { p_label: "  西区\n", p_code: `  ${CODE}\n` })
    ).data as string;
    expect((await admin.rpc("admin_reveal_invite_code", { p_id: id })).data).toBe(CODE);
    expect((await joinWith(CODE)).result.data?.error).toBeFalsy();
    expect((await admin.rpc("admin_list_invite_codes")).data?.map((r) => r.label)).toContain(
      "西区",
    );
  });

  test("参加で前後の空白は落とす（RPC を直接呼んでも）", async () => {
    const { client: admin } = await signInStaff("admin");
    await admin.rpc("admin_register_invite_code", { p_label: "西区", p_code: CODE });
    expect((await joinWith(`　${CODE}\t`)).result.data?.error).toBeFalsy();
  });

  test.each([
    ["7文字", "ab-1234"],
    ["記号なし", "abcdefgh2345"],
    ["数字なし", "abcd-efgh"],
    ["英字なし", "1234-5678"],
    ["空白入り", "abcd 12-34"],
    ["65文字", `a1-${"x".repeat(62)}`],
  ])("%s は invalid_invite_code_format", async (_name, code) => {
    const { client: admin } = await signInStaff("admin");
    const { error } = await admin.rpc("admin_register_invite_code", { p_label: "x", p_code: code });
    expect(error?.message).toBe("invalid_invite_code_format");
  });

  test("8文字・64文字ちょうどは登録できる", async () => {
    const { client: admin } = await signInStaff("admin");
    expect(
      (await admin.rpc("admin_register_invite_code", { p_label: "a", p_code: "abcd-123" })).error,
    ).toBeNull();
    expect(
      (
        await admin.rpc("admin_register_invite_code", {
          p_label: "b",
          p_code: `a1-${"x".repeat(61)}`,
        })
      ).error,
    ).toBeNull();
  });

  test.each([
    ["空", "  "],
    ["51文字", "あ".repeat(51)],
  ])("label が %s なら invalid_label", async (_name, label) => {
    const { client: admin } = await signInStaff("admin");
    const { error } = await admin.rpc("admin_register_invite_code", {
      p_label: label,
      p_code: CODE,
    });
    expect(error?.message).toBe("invalid_label");
  });

  test("有効なコードと同じなら duplicate_invite_code・失効済みと同じなら登録できる", async () => {
    const { client: admin } = await signInStaff("admin");
    const id = (await admin.rpc("admin_register_invite_code", { p_label: "A", p_code: CODE }))
      .data as string;
    expect(
      (await admin.rpc("admin_register_invite_code", { p_label: "B", p_code: CODE })).error
        ?.message,
    ).toBe("duplicate_invite_code");
    // 平文のない以前のコードとの重複も、ハッシュで見つける
    await withPg((db) =>
      db.query(
        "insert into private.invite_codes (label, code_hash) values ('legacy', extensions.crypt('legacy-code-99', extensions.gen_salt('bf')))",
      ),
    );
    expect(
      (await admin.rpc("admin_register_invite_code", { p_label: "D", p_code: "legacy-code-99" }))
        .error?.message,
    ).toBe("duplicate_invite_code");
    await admin.rpc("admin_revoke_invite_code", { p_id: id, p_revoke_volunteers: false });
    expect(
      (await admin.rpc("admin_register_invite_code", { p_label: "B", p_code: CODE })).error,
    ).toBeNull();
  });

  test("大文字を含むコードも登録でき、大文字小文字を変えると参加できない", async () => {
    const { client: admin } = await signInStaff("admin");
    expect(
      (await admin.rpc("admin_register_invite_code", { p_label: "A", p_code: CODE_B })).error,
    ).toBeNull();
    expect((await joinWith(CODE_B.toLowerCase())).result.data?.error).toBe("invalid_invite_code");
    expect((await joinWith(CODE_B)).result.data?.error).toBeFalsy();
  });

  test("一覧は label と人数だけで code_hash・code_plain を返さない・新しい順", async () => {
    const { client: admin } = await signInStaff("admin");
    await admin.rpc("admin_register_invite_code", { p_label: "A", p_code: CODE });
    await admin.rpc("admin_register_invite_code", { p_label: "B", p_code: CODE_B });
    const { data, error } = await admin.rpc("admin_list_invite_codes");
    expect(error).toBeNull();
    expect(Object.keys(data?.[0] ?? {}).sort()).toEqual([
      "active_volunteers",
      "created_at",
      "has_code",
      "id",
      "label",
      "revoked_at",
      "volunteers",
    ]);
    expect(data?.map((r) => r.label)).toEqual(["B", "A", "integration"]);
    expect(data?.find((r) => r.label === "A")?.has_code).toBe(true);
    expect(data?.find((r) => r.label === "integration")?.has_code).toBe(false);
  });

  test("失効だけなら参加済みの人は使い続けられる・新しく参加できない", async () => {
    const { client: admin } = await signInStaff("admin");
    const id = (await admin.rpc("admin_register_invite_code", { p_label: "A", p_code: CODE }))
      .data as string;
    const member = await joinWith(CODE, "はなこ");
    const boardId = await insertBoard("A-1");
    const r = await admin.rpc("admin_revoke_invite_code", { p_id: id, p_revoke_volunteers: false });
    expect(r.data).toBe(0);
    expect(
      (
        await member.client.rpc("update_board_status", {
          p_board_id: boardId,
          p_status: "reserved",
        })
      ).error,
    ).toBeNull();
    expect((await joinWith(CODE)).result.data?.error).toBe("invalid_invite_code");
    const row = (await admin.rpc("admin_list_invite_codes")).data?.find((x) => x.id === id);
    expect(row?.revoked_at).toBeTruthy();
    expect(row).toMatchObject({ volunteers: 1, active_volunteers: 1 });
  });

  test("失効と一緒に止めると、そのコードの人だけ止まり人数を返す", async () => {
    const { client: admin, email } = await signInStaff("admin");
    const id = (await admin.rpc("admin_register_invite_code", { p_label: "A", p_code: CODE }))
      .data as string;
    const other = await signInVolunteer("てすと");
    const m1 = await joinWith(CODE, "一人目");
    const m2 = await joinWith(CODE, "二人目");
    const r = await admin.rpc("admin_revoke_invite_code", { p_id: id, p_revoke_volunteers: true });
    expect(r.error).toBeNull();
    expect(r.data).toBe(2);
    expect((await m1.client.rpc("is_active_volunteer")).data).toBe(false);
    expect((await m2.client.rpc("is_active_volunteer")).data).toBe(false);
    expect((await other.client.rpc("is_active_volunteer")).data).toBe(true);
    const row = (await admin.rpc("admin_list_invite_codes")).data?.find((x) => x.id === id);
    expect(row).toMatchObject({ volunteers: 2, active_volunteers: 0 });
    expect(await auditRows("revoke_invite_code")).toEqual([
      { actor_email: email.toLowerCase(), target: "A（止めた人数: 2）" },
    ]);
  });

  test("存在しない id・失効済みは invite_code_not_found", async () => {
    const { client: admin } = await signInStaff("admin");
    expect(
      (
        await admin.rpc("admin_revoke_invite_code", {
          p_id: crypto.randomUUID(),
          p_revoke_volunteers: false,
        })
      ).error?.message,
    ).toBe("invite_code_not_found");
    const id = (await admin.rpc("admin_register_invite_code", { p_label: "A", p_code: CODE }))
      .data as string;
    await admin.rpc("admin_revoke_invite_code", { p_id: id, p_revoke_volunteers: false });
    expect(
      (await admin.rpc("admin_revoke_invite_code", { p_id: id, p_revoke_volunteers: true })).error
        ?.message,
    ).toBe("invite_code_not_found");
  });
});

// ---- service 経由（入力チェック・文言） ---------------------------------------

describe("admin service", () => {
  async function auditCount(): Promise<number> {
    return withPg(async (db) =>
      Number((await db.query("select count(*) as n from private.admin_audit_log")).rows[0].n),
    );
  }

  test("getAdminRole は役割を返し、一覧にない人は null", async () => {
    expect(await getAdminRole((await signInStaff("admin")).client)).toBe("admin");
    expect(await getAdminRole((await signInStaff("operator")).client)).toBe("operator");
    expect(await getAdminRole((await signInStaff(null)).client)).toBeNull();
    expect(await getAdminRole(anonClient())).toBeNull();
  });

  test("loadDashboard は一覧にない人で not_admin の文言を返す", async () => {
    const { client } = await signInStaff(null);
    expect(await loadDashboard(client)).toEqual({
      ok: false,
      error: "このアカウントでは管理画面に入れません。管理者に一覧への追加を頼んでください。",
    });
  });

  test("loadDashboard は運営に5つのまとまりを返す", async () => {
    await insertBoard("A-1");
    const { client } = await signInStaff("operator");
    const result = await loadDashboard(client);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.site.is_public).toBe(true);
    expect(result.data.wards).toEqual([{ ward: "中央区", total: 1, reserved: 0, done: 0 }]);
    expect(result.data.stale).toEqual([]);
    expect(result.data.dangerous).toEqual([]);
    expect(result.data.reports).toEqual([]);
  });

  test("registerInviteCode は記号のないコード・空の名前を RPC の前に断る（RPC は呼ばれず、記録も増えない）", async () => {
    const { client } = await signInStaff("admin");
    const rpc = jest.spyOn(client, "rpc");
    const before = await auditCount();
    expect(await registerInviteCode(client, "東区", "abcdefgh2345")).toEqual({
      ok: false,
      error:
        "参加コードは8〜64文字で、英字・数字・記号をそれぞれ1つ以上入れてください。空白は使えません。",
    });
    expect(await registerInviteCode(client, "  ", CODE)).toEqual({
      ok: false,
      error: "配布先の名前は1〜50文字で入れてください。",
    });
    expect(rpc).not.toHaveBeenCalled();
    expect(await auditCount()).toBe(before);
    const rows = await withPg((db) =>
      db.query("select 1 from private.invite_codes where label = '東区'"),
    );
    expect(rows.rowCount).toBe(0);
  });

  test("全角で渡したコードが半角で登録され、半角でも全角でも参加できる", async () => {
    const { client: admin } = await signInStaff("admin");
    expect(await registerInviteCode(admin, "　東区\n", "　ｔｅｓｔ－ｃｏｄｅ－２３４５\n")).toEqual(
      {
        ok: true,
        data: null,
      },
    );
    const plain = await withPg((db) =>
      db.query<{ code_plain: string }>(
        "select code_plain from private.invite_codes where label = '東区'",
      ),
    );
    expect(plain.rows[0].code_plain).toBe("test-code-2345");
    expect(await joinAsVolunteer(anonClient(), "test-code-2345", "はなこ")).toEqual({
      ok: true,
      data: { displayName: "はなこ" },
    });
    expect(await joinAsVolunteer(anonClient(), "ｔｅｓｔ－ｃｏｄｅ－２３４５ ", "じろう")).toEqual({
      ok: true,
      data: { displayName: "じろう" },
    });
  });

  test("DB の例外は文言になる（重複・見つからない・forbidden）", async () => {
    const { client: admin } = await signInStaff("admin");
    expect((await registerInviteCode(admin, "A", CODE)).ok).toBe(true);
    expect(await registerInviteCode(admin, "B", CODE)).toEqual({
      ok: false,
      error: "同じ参加コードがすでに登録されています。別のコードにしてください。",
    });
    expect(await revokeInviteCode(admin, crypto.randomUUID(), false)).toEqual({
      ok: false,
      error: "参加コードが見つからないか、すでに失効しています。画面を更新してください。",
    });
    const { client: operator } = await signInStaff("operator");
    expect(await registerInviteCode(operator, "C", CODE_B)).toEqual({
      ok: false,
      error: "この操作は管理者だけができます。",
    });
  });

  test("表示・失効・一覧・記録", async () => {
    const { client: admin } = await signInStaff("admin");
    await registerInviteCode(admin, "南区", CODE);
    const list = await loadInviteCodes(admin);
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    const row = list.data.find((r) => r.label === "南区");
    expect(row).toMatchObject({ has_code: true, revoked_at: null });
    const id = row?.id as string;
    expect(await revealInviteCode(admin, id)).toEqual({ ok: true, data: { code: CODE } });
    await joinAsVolunteer(anonClient(), CODE, "はなこ");
    expect(await revokeInviteCode(admin, id, true)).toEqual({
      ok: true,
      data: { revokedVolunteers: 1 },
    });
    const audit = await loadAuditLog(admin);
    expect(audit.ok && audit.data.map((r) => r.action)).toEqual([
      "revoke_invite_code",
      "reveal_invite_code",
      "register_invite_code",
    ]);
  });

  test("平文のない以前のコードの表示は code: null", async () => {
    const { client: admin } = await signInStaff("admin");
    const list = await loadInviteCodes(admin);
    const id = list.ok ? list.data.find((r) => r.label === "integration")?.id : undefined;
    expect(await revealInviteCode(admin, id as string)).toEqual({ ok: true, data: { code: null } });
  });

  test("setForceHidden と resetRehearsal", async () => {
    const { client } = await signInStaff("admin");
    expect(await setForceHidden(client, true)).toEqual({ ok: true, data: null });
    const dashboard = await loadDashboard(client);
    expect(dashboard.ok && dashboard.data.site.force_hidden).toBe(true);
    expect(await resetRehearsal(client, "ちがう")).toEqual({
      ok: false,
      error: "確認の文字が違います。「リセット」と入れてください。",
    });
    expect(await resetRehearsal(client, "リセット")).toEqual({ ok: true, data: null });
    await setAdminSettings({ rehearsalResetUntil: "now() - interval '1 minute'" });
    expect(await resetRehearsal(client, "リセット")).toEqual({
      ok: false,
      error: "11月1日0:00を過ぎたため、報告をまとめて戻すことはできません。",
    });
  });
});

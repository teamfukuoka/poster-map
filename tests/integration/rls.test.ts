import {
  anonClient,
  countInviteCodeFailures,
  insertBoard,
  insertInviteCodeFailures,
  resetDatabase,
  revokeInviteCodes,
  revokeVolunteer,
  setPublicWindow,
  signInAnon,
  signInVolunteer,
  TEST_INVITE_CODE,
  type TestClient,
  withPg,
} from "./helpers";

beforeEach(async () => {
  await resetDatabase();
});

describe("掲示板の閲覧（公開期間）", () => {
  test("公開期間中は未ログインでも読める", async () => {
    await insertBoard("A-1");
    const { data, error } = await anonClient().from("poster_boards").select("number");
    expect(error).toBeNull();
    expect(data).toEqual([{ number: "A-1" }]);
  });

  test.each([
    "before",
    "after",
    "hidden",
  ] as const)("公開期間外（%s）は未ログインだと空になる", async (mode) => {
    await insertBoard("A-1");
    await setPublicWindow(mode);
    const { data, error } = await anonClient().from("poster_boards").select("number");
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  test("is_public_window は設定どおりに変わる", async () => {
    const anon = anonClient();
    expect((await anon.rpc("is_public_window")).data).toBe(true);
    await setPublicWindow("hidden");
    expect((await anon.rpc("is_public_window")).data).toBe(false);
    await setPublicWindow("before");
    expect((await anon.rpc("is_public_window")).data).toBe(false);
  });

  test("ボランティアは公開期間外でも読める", async () => {
    await insertBoard("A-1");
    await setPublicWindow("before");
    const { client } = await signInVolunteer("たろう");
    const { data } = await client.from("poster_boards").select("number");
    expect(data).toEqual([{ number: "A-1" }]);
  });

  test("参加していない匿名ユーザーは公開期間外に読めない", async () => {
    await insertBoard("A-1");
    await setPublicWindow("before");
    const { client } = await signInAnon();
    const { data } = await client.from("poster_boards").select("number");
    expect(data).toEqual([]);
  });

  test("掲示板を直接 update できない（未ログインもボランティアも）", async () => {
    const id = await insertBoard("A-1");
    const anonResult = await anonClient()
      .from("poster_boards")
      .update({ status: "done" })
      .eq("id", id);
    expect(anonResult.error).not.toBeNull();

    const { client } = await signInVolunteer("たろう");
    const volunteerResult = await client
      .from("poster_boards")
      .update({ status: "done" })
      .eq("id", id);
    expect(volunteerResult.error).not.toBeNull();

    const status = await withPg((db) =>
      db.query("select status from public.poster_boards where id = $1", [id]),
    );
    expect(status.rows[0].status).toBe("not_yet");
  });
});

describe("register_volunteer", () => {
  const register = (client: TestClient, code: string, name = "たろう") =>
    client.rpc("register_volunteer", { p_code: code, p_display_name: name });

  test("正しいコードで参加でき、名前の前後の空白は取り除かれる", async () => {
    const { client, userId } = await signInAnon();
    const { data, error } = await register(client, TEST_INVITE_CODE, "  たろう  ");
    expect(error).toBeNull();
    expect(data).toEqual({ display_name: "たろう", error: null });
    const rows = await withPg(
      async (db) => (await db.query("select user_id, display_name from public.volunteers")).rows,
    );
    expect(rows).toEqual([{ user_id: userId, display_name: "たろう" }]);
  });

  test("名前の前後の全角空白・改行も取り除かれる（JS の trim と同じ）", async () => {
    const { client } = await signInAnon();
    const { data } = await register(client, TEST_INVITE_CODE, "\u3000\n たろう\t\u3000");
    expect(data?.display_name).toBe("たろう");
  });

  test.each([
    ["名前が空", TEST_INVITE_CODE, "   ", "invalid_display_name"],
    ["名前が全角空白だけ", TEST_INVITE_CODE, "\u3000\u3000", "invalid_display_name"],
    ["名前が21文字", TEST_INVITE_CODE, "あ".repeat(21), "invalid_display_name"],
  ])("%s は拒否される", async (_label, code, name, message) => {
    const { client } = await signInAnon();
    const { error } = await register(client, code, name);
    expect(error?.message).toBe(message);
  });

  test("コード違いは例外ではなく error で返り、失敗が記録される", async () => {
    const { client, userId } = await signInAnon();
    const { data, error } = await register(client, "wrong-code");
    expect(error).toBeNull();
    expect(data).toEqual({ display_name: null, error: "invalid_invite_code" });
    expect(await countInviteCodeFailures(userId)).toBe(1);
    const rows = await withPg(
      async (db) => (await db.query("select 1 from public.volunteers")).rows,
    );
    expect(rows).toEqual([]);
  });

  test("失効したコードは拒否される", async () => {
    await revokeInviteCodes();
    const { client } = await signInAnon();
    const { data } = await register(client, TEST_INVITE_CODE);
    expect(data?.error).toBe("invalid_invite_code");
  });

  test("5 回続けて間違えると、次は正しいコードでも too_many_attempts", async () => {
    const { client, userId } = await signInAnon();
    for (let i = 0; i < 5; i++) {
      expect((await register(client, `wrong-${i}`)).data?.error).toBe("invalid_invite_code");
    }
    const { data, error } = await register(client, TEST_INVITE_CODE);
    expect(data).toBeNull();
    expect(error?.message).toBe("too_many_attempts");
    // 拒否した試行は数えない（窓が過ぎれば元に戻る）
    expect(await countInviteCodeFailures(userId)).toBe(5);
  });

  test("上限に達していなければ（4 回の失敗）、正しいコードで参加でき、失敗の記録は消える", async () => {
    const { client, userId } = await signInAnon();
    for (let i = 0; i < 4; i++) {
      await register(client, `wrong-${i}`);
    }
    const { data, error } = await register(client, TEST_INVITE_CODE);
    expect(error).toBeNull();
    expect(data).toEqual({ display_name: "たろう", error: null });
    expect(await countInviteCodeFailures(userId)).toBe(0);
  });

  test("上限は 1 人ずつ。別のユーザーには影響しない", async () => {
    const blocked = await signInAnon();
    await insertInviteCodeFailures(blocked.userId, 5);
    expect((await register(blocked.client, TEST_INVITE_CODE)).error?.message).toBe(
      "too_many_attempts",
    );

    const other = await signInAnon();
    const { data, error } = await register(other.client, TEST_INVITE_CODE, "はなこ");
    expect(error).toBeNull();
    expect(data?.display_name).toBe("はなこ");
  });

  test("15 分より前の失敗は数えず、次の失敗のときに消す", async () => {
    const { client, userId } = await signInAnon();
    await insertInviteCodeFailures(userId, 5, "16 minutes");
    await insertInviteCodeFailures(userId, 4);
    expect((await register(client, "wrong")).data?.error).toBe("invalid_invite_code");
    expect(await countInviteCodeFailures(userId)).toBe(5);
    expect((await register(client, TEST_INVITE_CODE)).error?.message).toBe("too_many_attempts");
  });

  test("ユーザーを消すと失敗の記録も消える", async () => {
    const { client, userId } = await signInAnon();
    await register(client, "wrong");
    expect(await countInviteCodeFailures(userId)).toBe(1);
    await withPg((db) => db.query("delete from auth.users where id = $1", [userId]));
    expect(await countInviteCodeFailures()).toBe(0);
  });

  test("もう一度呼ぶとニックネームが変わる", async () => {
    const { client } = await signInVolunteer("たろう");
    const { data } = await register(client, TEST_INVITE_CODE, "じろう");
    expect(data?.display_name).toBe("じろう");
  });

  test("参加を停止された人は、再登録で停止を解除できない", async () => {
    const { client, userId } = await signInVolunteer("たろう");
    await revokeVolunteer(userId);
    const { error } = await register(client, TEST_INVITE_CODE);
    expect(error?.message).toBe("volunteer_revoked");
  });

  test("未ログインでは呼べない", async () => {
    const { error } = await register(anonClient(), TEST_INVITE_CODE);
    expect(error).not.toBeNull();
  });
});

describe("update_board_status", () => {
  test("ボランティアは更新でき、履歴が残る", async () => {
    const id = await insertBoard("A-1");
    const { client, userId } = await signInVolunteer("たろう");
    const { data, error } = await client.rpc("update_board_status", {
      p_board_id: id,
      p_status: "done",
      p_note: "  貼りました  ",
    });
    expect(error).toBeNull();
    expect(data?.status).toBe("done");

    const history = await client
      .from("poster_board_status_history")
      .select("user_id, display_name, previous_status, new_status, note")
      .eq("board_id", id);
    expect(history.data).toEqual([
      {
        user_id: userId,
        display_name: "たろう",
        previous_status: "not_yet",
        new_status: "done",
        note: "貼りました",
      },
    ]);
  });

  test("連絡事項の前後の全角空白・改行も取り除かれる（JS の trim と同じ）", async () => {
    const id = await insertBoard("A-1");
    const { client } = await signInVolunteer("たろう");
    await client.rpc("update_board_status", {
      p_board_id: id,
      p_status: "done",
      p_note: "\u3000\n貼りました\r\n\u3000",
    });
    await client.rpc("update_board_status", {
      p_board_id: id,
      p_status: "reserved",
      p_note: "\u3000\n\t",
    });
    const history = await client
      .from("poster_board_status_history")
      .select("note")
      .order("created_at");
    expect(history.data).toEqual([{ note: "貼りました" }, { note: null }]);
  });

  test("空の連絡事項は null で保存される", async () => {
    const id = await insertBoard("A-1");
    const { client } = await signInVolunteer("たろう");
    await client.rpc("update_board_status", {
      p_board_id: id,
      p_status: "reserved",
      p_note: "   ",
    });
    const history = await client.from("poster_board_status_history").select("note");
    expect(history.data).toEqual([{ note: null }]);
  });

  test("参加していない人は更新できない", async () => {
    const id = await insertBoard("A-1");
    const { client } = await signInAnon();
    const { error } = await client.rpc("update_board_status", { p_board_id: id, p_status: "done" });
    expect(error?.message).toBe("not_a_volunteer");
  });

  test("停止された人は更新できない", async () => {
    const id = await insertBoard("A-1");
    const { client, userId } = await signInVolunteer("たろう");
    await revokeVolunteer(userId);
    const { error } = await client.rpc("update_board_status", { p_board_id: id, p_status: "done" });
    expect(error?.message).toBe("not_a_volunteer");
  });

  test("連絡事項が501文字だと拒否される", async () => {
    const id = await insertBoard("A-1");
    const { client } = await signInVolunteer("たろう");
    const { error } = await client.rpc("update_board_status", {
      p_board_id: id,
      p_status: "done",
      p_note: "あ".repeat(501),
    });
    expect(error?.message).toBe("note_too_long");
  });

  test("存在しない掲示板は board_not_found", async () => {
    const { client } = await signInVolunteer("たろう");
    const { error } = await client.rpc("update_board_status", {
      p_board_id: "00000000-0000-0000-0000-000000000000",
      p_status: "done",
    });
    expect(error?.message).toBe("board_not_found");
  });

  test("未ログインでは呼べない", async () => {
    const id = await insertBoard("A-1");
    const { error } = await anonClient().rpc("update_board_status", {
      p_board_id: id,
      p_status: "done",
    });
    expect(error).not.toBeNull();
  });
});

describe("履歴と参加情報の見え方", () => {
  test("履歴はボランティアだけが読める", async () => {
    const id = await insertBoard("A-1");
    const volunteer = await signInVolunteer("たろう");
    await volunteer.client.rpc("update_board_status", { p_board_id: id, p_status: "done" });

    const other = await signInVolunteer("はなこ");
    const visible = await other.client.from("poster_board_status_history").select("new_status");
    expect(visible.data).toEqual([{ new_status: "done" }]);

    const stranger = await signInAnon();
    const hidden = await stranger.client.from("poster_board_status_history").select("new_status");
    expect(hidden.data).toEqual([]);

    const anon = await anonClient().from("poster_board_status_history").select("new_status");
    expect(anon.error).not.toBeNull();
  });

  test("volunteers は自分の行しか見えない", async () => {
    await signInVolunteer("たろう");
    const me = await signInVolunteer("はなこ");
    const { data } = await me.client.from("volunteers").select("user_id, display_name");
    expect(data).toEqual([{ user_id: me.userId, display_name: "はなこ" }]);
  });

  // ローカルは管理者として入るためにメールのサインアップを有効にしている（supabase/config.toml）。
  // 本番の Email provider は OFF のまま。ここでは、メールのユーザーが参加者として扱われないことだけ確かめる
  test("メールアドレスで作ったユーザーは参加者として扱われない", async () => {
    const client = anonClient();
    const { data, error } = await client.auth.signUp({
      email: "someone@example.invalid",
      password: "long-enough-password-123",
    });
    expect(error).toBeNull();
    expect(data.session).not.toBeNull();
    expect((await client.rpc("is_active_volunteer")).data).toBe(false);
    expect((await client.from("volunteers").select("user_id")).data).toEqual([]);
  });
});

describe("関数の EXECUTE 権限（migration の grant / revoke と一致する）", () => {
  // 引数の型は supabase/migrations/*_poster_map.sql の関数定義と同じにする
  const expected = [
    { signature: "public.is_active_volunteer()", anon: true, authenticated: true },
    { signature: "public.is_public_window()", anon: true, authenticated: true },
    { signature: "public.register_volunteer(text, text)", anon: false, authenticated: true },
    {
      signature: "public.update_board_status(uuid, public.poster_board_status, text)",
      anon: false,
      authenticated: true,
    },
    { signature: "public.admin_whoami()", anon: false, authenticated: true },
    { signature: "public.admin_recent_audit_log()", anon: false, authenticated: true },
  ] as const;

  test("public スキーマの全関数について anon / authenticated / public の権限が意図どおり", async () => {
    const actual = await withPg(async (db) => {
      const rows: { signature: string; anon: boolean; authenticated: boolean; public: boolean }[] =
        [];
      for (const { signature } of expected) {
        const result = await db.query<{ anon: boolean; authenticated: boolean; public: boolean }>(
          "select has_function_privilege('anon', $1, 'execute') as anon, has_function_privilege('authenticated', $1, 'execute') as authenticated, has_function_privilege('public', $1, 'execute') as public",
          [signature],
        );
        rows.push({ signature, ...result.rows[0] });
      }
      return rows;
    });
    expect(actual).toEqual(
      expected.map(({ signature, anon, authenticated }) => ({
        signature,
        anon,
        authenticated,
        public: false,
      })),
    );
  });

  test("上の表は public スキーマの関数を漏れなく含む（関数を足したら表も足す）", async () => {
    const functions = await withPg((db) =>
      db.query<{ name: string }>(
        `select p.proname as name
         from pg_proc p
         join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public'
           and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
         order by p.proname`,
      ),
    );
    expect(functions.rows.map((row) => row.name)).toEqual(
      expected.map(({ signature }) => signature.slice("public.".length).split("(")[0]).sort(),
    );
  });
});

describe("直接書き込み・private schema へのアクセスは拒否される", () => {
  const count = (table: string) =>
    withPg(async (db) => {
      const result = await db.query<{ n: string }>(`select count(*) as n from ${table}`);
      return Number(result.rows[0].n);
    });

  test("匿名サインインしただけのユーザーは volunteers に自分を insert できない", async () => {
    const { client, userId } = await signInAnon();
    const { error } = await client
      .from("volunteers")
      .insert({ user_id: userId, display_name: "x" });
    expect(error).not.toBeNull();
    expect(await count("public.volunteers")).toBe(0);
  });

  test("停止されたボランティアは volunteers を update して停止を解除できない", async () => {
    const { client, userId } = await signInVolunteer("たろう");
    await revokeVolunteer(userId);
    const { error } = await client
      .from("volunteers")
      .update({ revoked_at: null })
      .eq("user_id", userId);
    expect(error).not.toBeNull();
    const row = await withPg((db) =>
      db.query("select revoked_at from public.volunteers where user_id = $1", [userId]),
    );
    expect(row.rows[0].revoked_at).not.toBeNull();
  });

  test("ボランティアは poster_board_status_history に直接 insert できない", async () => {
    const id = await insertBoard("A-1");
    const { client, userId } = await signInVolunteer("たろう");
    const { error } = await client.from("poster_board_status_history").insert({
      board_id: id,
      user_id: userId,
      display_name: "たろう",
      previous_status: "not_yet",
      new_status: "done",
    });
    expect(error).not.toBeNull();
    expect(await count("public.poster_board_status_history")).toBe(0);
  });

  test("未ログインは poster_boards に insert も delete もできない", async () => {
    const id = await insertBoard("A-1");
    const anon = anonClient();
    const inserted = await anon.from("poster_boards").insert({
      number: "A-2",
      name: "掲示板A-2",
      address: "中央区天神A-2",
      ward: "中央区",
      lat: 33.59,
      long: 130.4,
    });
    expect(inserted.error).not.toBeNull();
    const deleted = await anon.from("poster_boards").delete().eq("id", id);
    expect(deleted.error).not.toBeNull();
    expect(await count("public.poster_boards")).toBe(1);
  });

  test.each([
    "invite_codes",
    "invite_code_failures",
  ])("private.%s は API から読めない", async (table) => {
    const { client } = await signInVolunteer("たろう");
    // private は生成された型に無いので、schema 名だけ最小限のキャストで渡す
    const volunteer = await client
      .schema("private" as never)
      .from(table as never)
      .select();
    expect(volunteer.error).not.toBeNull();
    const anon = await anonClient()
      .schema("private" as never)
      .from(table as never)
      .select();
    expect(anon.error).not.toBeNull();
  });

  test("private.trim_js は anon / authenticated から実行できない", async () => {
    const result = await withPg((db) =>
      db.query<{ anon: boolean; authenticated: boolean; public: boolean }>(
        "select has_function_privilege('anon', 'private.trim_js(text)', 'execute') as anon, has_function_privilege('authenticated', 'private.trim_js(text)', 'execute') as authenticated, has_function_privilege('public', 'private.trim_js(text)', 'execute') as public",
      ),
    );
    expect(result.rows[0]).toEqual({ anon: false, authenticated: false, public: false });
  });

  test("private.invite_code_failures は anon / authenticated に権限がなく、RLS も有効", async () => {
    const result = await withPg((db) =>
      db.query<{ anon: boolean; authenticated: boolean; rls: boolean }>(
        `select
           has_table_privilege('anon', 'private.invite_code_failures', 'select,insert,update,delete') as anon,
           has_table_privilege('authenticated', 'private.invite_code_failures', 'select,insert,update,delete') as authenticated,
           (select relrowsecurity from pg_class where oid = 'private.invite_code_failures'::regclass) as rls`,
      ),
    );
    expect(result.rows[0]).toEqual({ anon: false, authenticated: false, rls: true });
  });
});

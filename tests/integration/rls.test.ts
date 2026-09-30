import {
  anonClient,
  insertBoard,
  resetDatabase,
  revokeInviteCodes,
  revokeVolunteer,
  setPublicWindow,
  signInAnon,
  signInVolunteer,
  TEST_INVITE_CODE,
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
  test("正しいコードで参加でき、名前の前後の空白は取り除かれる", async () => {
    const { client, userId } = await signInAnon();
    const { data, error } = await client.rpc("register_volunteer", {
      p_code: TEST_INVITE_CODE,
      p_display_name: "  たろう  ",
    });
    expect(error).toBeNull();
    expect(data).toMatchObject({ user_id: userId, display_name: "たろう" });
  });

  test.each([
    ["コード違い", "wrong-code", "たろう", "invalid_invite_code"],
    ["名前が空", TEST_INVITE_CODE, "   ", "invalid_display_name"],
    ["名前が21文字", TEST_INVITE_CODE, "あ".repeat(21), "invalid_display_name"],
  ])("%s は拒否される", async (_label, code, name, message) => {
    const { client } = await signInAnon();
    const { error } = await client.rpc("register_volunteer", {
      p_code: code,
      p_display_name: name,
    });
    expect(error?.message).toBe(message);
  });

  test("失効したコードは拒否される", async () => {
    await revokeInviteCodes();
    const { client } = await signInAnon();
    const { error } = await client.rpc("register_volunteer", {
      p_code: TEST_INVITE_CODE,
      p_display_name: "たろう",
    });
    expect(error?.message).toBe("invalid_invite_code");
  });

  test("もう一度呼ぶとニックネームが変わる", async () => {
    const { client } = await signInVolunteer("たろう");
    const { data } = await client.rpc("register_volunteer", {
      p_code: TEST_INVITE_CODE,
      p_display_name: "じろう",
    });
    expect(data?.display_name).toBe("じろう");
  });

  test("参加を停止された人は、再登録で停止を解除できない", async () => {
    const { client, userId } = await signInVolunteer("たろう");
    await revokeVolunteer(userId);
    const { error } = await client.rpc("register_volunteer", {
      p_code: TEST_INVITE_CODE,
      p_display_name: "たろう",
    });
    expect(error?.message).toBe("volunteer_revoked");
  });

  test("未ログインでは呼べない", async () => {
    const { error } = await anonClient().rpc("register_volunteer", {
      p_code: TEST_INVITE_CODE,
      p_display_name: "たろう",
    });
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

  test("メールアドレスでは登録できない", async () => {
    const { error } = await anonClient().auth.signUp({
      email: "someone@example.com",
      password: "long-enough-password-123",
    });
    expect(error).not.toBeNull();
  });
});

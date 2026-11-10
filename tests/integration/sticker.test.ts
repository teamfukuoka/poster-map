import {
  anonClient,
  insertBoard,
  resetDatabase,
  revokeVolunteer,
  setAdminSettings,
  signInAnon,
  signInStaff,
  signInVolunteer,
  withPg,
} from "./helpers";

beforeEach(async () => {
  await resetDatabase();
});

async function stickerHistory(boardId: string) {
  return withPg(async (db) => {
    const result = await db.query<{
      display_name: string;
      previous_status: string;
      new_status: string;
      note: string | null;
    }>(
      "select display_name, previous_status, new_status, note from public.sticker_status_history where board_id = $1 order by created_at, id",
      [boardId],
    );
    return result.rows;
  });
}

async function stickerStatus(boardId: string): Promise<string | null> {
  return withPg(async (db) => {
    const result = await db.query<{ status: string }>(
      "select status from public.board_stickers where board_id = $1",
      [boardId],
    );
    return result.rows[0]?.status ?? null;
  });
}

async function auditRows(action: string) {
  return withPg(async (db) => {
    const result = await db.query<{ actor_email: string; target: string | null }>(
      "select actor_email, target from private.admin_audit_log where action = $1 order by id",
      [action],
    );
    return result.rows;
  });
}

describe("is_sticker_enabled", () => {
  test("既定は OFF・ON にすると誰からも true", async () => {
    expect((await anonClient().rpc("is_sticker_enabled")).data).toBe(false);
    await setAdminSettings({ stickerEnabled: true });
    expect((await anonClient().rpc("is_sticker_enabled")).data).toBe(true);
    const { client } = await signInVolunteer("たろう");
    expect((await client.rpc("is_sticker_enabled")).data).toBe(true);
  });
});

describe("update_sticker_status", () => {
  beforeEach(async () => {
    await setAdminSettings({ stickerEnabled: true });
  });

  test("ボランティアはポスター完了の掲示板を完了にできる・履歴が残る", async () => {
    const boardId = await insertBoard("1-1", "done");
    const { client } = await signInVolunteer("たろう");
    const { data, error } = await client.rpc("update_sticker_status", {
      p_board_id: boardId,
      p_status: "done",
      p_note: "  右下に貼りました  ",
    });
    expect(error).toBeNull();
    expect(data).toMatchObject({ board_id: boardId, status: "done" });
    expect(await stickerHistory(boardId)).toEqual([
      {
        display_name: "たろう",
        previous_status: "not_yet",
        new_status: "done",
        note: "右下に貼りました",
      },
    ]);
  });

  test("2 回目の報告は前の状態を履歴に残す", async () => {
    const boardId = await insertBoard("1-1", "done");
    const { client } = await signInVolunteer("たろう");
    await client.rpc("update_sticker_status", { p_board_id: boardId, p_status: "reserved" });
    await client.rpc("update_sticker_status", { p_board_id: boardId, p_status: "done" });
    expect(await stickerStatus(boardId)).toBe("done");
    expect((await stickerHistory(boardId)).map((h) => [h.previous_status, h.new_status])).toEqual([
      ["not_yet", "reserved"],
      ["reserved", "done"],
    ]);
  });

  test("ポスターが完了でない掲示板は予約・完了にできない（poster_not_done）", async () => {
    const boardId = await insertBoard("1-1", "not_yet");
    const { client } = await signInVolunteer("たろう");
    for (const status of ["reserved", "done"] as const) {
      const { error } = await client.rpc("update_sticker_status", {
        p_board_id: boardId,
        p_status: status,
      });
      expect(error?.message).toBe("poster_not_done");
    }
    expect(await stickerStatus(boardId)).toBeNull();
    expect(await stickerHistory(boardId)).toEqual([]);
  });

  test("問題ありはポスターが完了でなくても報告できる", async () => {
    const boardId = await insertBoard("1-1", "error_wrong_poster");
    const { client } = await signInVolunteer("たろう");
    const { error } = await client.rpc("update_sticker_status", {
      p_board_id: boardId,
      p_status: "issue",
      p_note: "ポスターが剥がれている",
    });
    expect(error).toBeNull();
    expect(await stickerStatus(boardId)).toBe("issue");
  });

  test("シールが OFF の間は報告できない（sticker_not_started）", async () => {
    await setAdminSettings({ stickerEnabled: false });
    const boardId = await insertBoard("1-1", "done");
    const { client } = await signInVolunteer("たろう");
    const { error } = await client.rpc("update_sticker_status", {
      p_board_id: boardId,
      p_status: "done",
    });
    expect(error?.message).toBe("sticker_not_started");
    expect(await stickerStatus(boardId)).toBeNull();
  });

  test("参加していない人・止められたボランティアは書けない", async () => {
    const boardId = await insertBoard("1-1", "done");
    const { client: anon } = await signInAnon();
    expect(
      (await anon.rpc("update_sticker_status", { p_board_id: boardId, p_status: "done" })).error
        ?.message,
    ).toBe("not_a_volunteer");

    const { client, userId } = await signInVolunteer("たろう");
    await revokeVolunteer(userId);
    expect(
      (await client.rpc("update_sticker_status", { p_board_id: boardId, p_status: "done" })).error
        ?.message,
    ).toBe("not_a_volunteer");

    expect(
      (await anonClient().rpc("update_sticker_status", { p_board_id: boardId, p_status: "done" }))
        .error,
    ).not.toBeNull();
    expect(await stickerStatus(boardId)).toBeNull();
  });

  test("メモは 500 文字まで・ない掲示板は board_not_found", async () => {
    const boardId = await insertBoard("1-1", "done");
    const { client } = await signInVolunteer("たろう");
    expect(
      (
        await client.rpc("update_sticker_status", {
          p_board_id: boardId,
          p_status: "issue",
          p_note: "あ".repeat(501),
        })
      ).error?.message,
    ).toBe("note_too_long");
    expect(
      (
        await client.rpc("update_sticker_status", {
          p_board_id: crypto.randomUUID(),
          p_status: "issue",
        })
      ).error?.message,
    ).toBe("board_not_found");
  });

  test("シールの報告はポスターの状態を変えない", async () => {
    const boardId = await insertBoard("1-1", "done");
    const { client } = await signInVolunteer("たろう");
    await client.rpc("update_sticker_status", { p_board_id: boardId, p_status: "issue" });
    const board = await client.from("poster_boards").select("status").eq("id", boardId).single();
    expect(board.data?.status).toBe("done");
  });
});

describe("シールの状態と履歴の見え方", () => {
  test("ボランティアは読める・匿名と一般の人は読めない", async () => {
    await setAdminSettings({ stickerEnabled: true });
    const boardId = await insertBoard("1-1", "done");
    const { client } = await signInVolunteer("たろう");
    await client.rpc("update_sticker_status", { p_board_id: boardId, p_status: "done" });

    expect((await client.from("board_stickers").select("board_id, status")).data).toEqual([
      { board_id: boardId, status: "done" },
    ]);
    expect((await client.from("sticker_status_history").select("new_status")).data).toEqual([
      { new_status: "done" },
    ]);

    const { client: signedIn } = await signInAnon();
    expect((await signedIn.from("board_stickers").select("board_id")).data).toEqual([]);
    expect((await signedIn.from("sticker_status_history").select("id")).data).toEqual([]);

    const anon = anonClient();
    expect((await anon.from("board_stickers").select("board_id")).error).not.toBeNull();
    expect((await anon.from("sticker_status_history").select("id")).error).not.toBeNull();
  });

  test("ボランティアでも直接は書き込めない", async () => {
    const boardId = await insertBoard("1-1", "done");
    const { client } = await signInVolunteer("たろう");
    expect(
      (await client.from("board_stickers").insert({ board_id: boardId, status: "done" })).error,
    ).not.toBeNull();
    expect(await stickerStatus(boardId)).toBeNull();
  });
});

describe("シールのまとめて予約", () => {
  beforeEach(async () => {
    await setAdminSettings({ stickerEnabled: true });
  });

  test("ポスター完了かつシール未の掲示板だけ予約になる", async () => {
    const done1 = await insertBoard("1-1", "done");
    const done2 = await insertBoard("1-2", "done");
    const posterNotYet = await insertBoard("1-3", "not_yet");
    const alreadyDone = await insertBoard("1-4", "done");
    const { client } = await signInVolunteer("たろう");
    await client.rpc("update_sticker_status", { p_board_id: alreadyDone, p_status: "done" });

    const { data, error } = await client.rpc("reserve_stickers", {
      p_board_ids: [done1, done2, posterNotYet, alreadyDone],
    });
    expect(error).toBeNull();
    expect([...(data ?? [])].sort()).toEqual([done1, done2].sort());
    expect(await stickerStatus(posterNotYet)).toBeNull();
    expect(await stickerStatus(alreadyDone)).toBe("done");
    expect((await client.rpc("my_reserved_sticker_board_ids")).data?.sort()).toEqual(
      [done1, done2].sort(),
    );
  });

  test("31 か所以上は too_many_boards", async () => {
    const { client } = await signInVolunteer("たろう");
    const ids = Array.from({ length: 31 }, () => crypto.randomUUID());
    expect((await client.rpc("reserve_stickers", { p_board_ids: ids })).error?.message).toBe(
      "too_many_boards",
    );
  });

  test("シールが OFF の間は予約できない", async () => {
    await setAdminSettings({ stickerEnabled: false });
    const boardId = await insertBoard("1-1", "done");
    const { client } = await signInVolunteer("たろう");
    expect((await client.rpc("reserve_stickers", { p_board_ids: [boardId] })).error?.message).toBe(
      "sticker_not_started",
    );
  });

  test("自分の予約だけをまとめて未に戻す", async () => {
    const mine = await insertBoard("1-1", "done");
    const others = await insertBoard("1-2", "done");
    const { client: taro } = await signInVolunteer("たろう");
    const { client: hanako } = await signInVolunteer("はなこ");
    await taro.rpc("reserve_stickers", { p_board_ids: [mine] });
    await hanako.rpc("reserve_stickers", { p_board_ids: [others] });

    const { data, error } = await taro.rpc("release_my_sticker_reservations");
    expect(error).toBeNull();
    expect(data).toEqual([mine]);
    expect(await stickerStatus(mine)).toBe("not_yet");
    expect(await stickerStatus(others)).toBe("reserved");
    expect((await stickerHistory(mine)).map((h) => h.new_status)).toEqual(["reserved", "not_yet"]);
  });
});

describe("管理画面のシール", () => {
  test("admin は ON/OFF でき、記録が残る・operator と一覧にない人はできない", async () => {
    const { client: operator } = await signInStaff("operator");
    expect(
      (await operator.rpc("admin_set_sticker_enabled", { p_enabled: true })).error?.message,
    ).toBe("forbidden");
    const { client: stranger } = await signInStaff(null);
    expect(
      (await stranger.rpc("admin_set_sticker_enabled", { p_enabled: true })).error?.message,
    ).toBe("not_admin");
    expect((await anonClient().rpc("is_sticker_enabled")).data).toBe(false);

    const { client, email } = await signInStaff("admin");
    expect((await client.rpc("admin_set_sticker_enabled", { p_enabled: true })).data).toBe(true);
    expect((await anonClient().rpc("is_sticker_enabled")).data).toBe(true);
    await client.rpc("admin_set_sticker_enabled", { p_enabled: false });
    expect((await anonClient().rpc("is_sticker_enabled")).data).toBe(false);
    expect(await auditRows("set_sticker_enabled")).toEqual([
      { actor_email: email.toLowerCase(), target: "true" },
      { actor_email: email.toLowerCase(), target: "false" },
    ]);
  });

  test("区ごとの進み具合と問題ありの一覧", async () => {
    await setAdminSettings({ stickerEnabled: true });
    const a = await insertBoard("1-1", "done", "中央区");
    const b = await insertBoard("1-2", "done", "中央区");
    await insertBoard("1-3", "not_yet", "中央区");
    const c = await insertBoard("2-1", "done", "博多区");
    const { client: volunteer } = await signInVolunteer("たろう");
    await volunteer.rpc("update_sticker_status", { p_board_id: a, p_status: "done" });
    await volunteer.rpc("update_sticker_status", { p_board_id: b, p_status: "reserved" });
    await volunteer.rpc("update_sticker_status", {
      p_board_id: c,
      p_status: "issue",
      p_note: "ポスターが破れている",
    });

    const { client } = await signInStaff("operator");
    const progress = await client.rpc("admin_sticker_progress");
    expect(progress.error).toBeNull();
    expect(progress.data).toEqual([
      { ward: "中央区", target: 2, reserved: 1, done: 1, issue: 0 },
      { ward: "博多区", target: 1, reserved: 0, done: 0, issue: 1 },
    ]);

    const issues = await client.rpc("admin_sticker_issues");
    expect(issues.error).toBeNull();
    expect(issues.data).toEqual([
      expect.objectContaining({
        board_id: c,
        number: "2-1",
        ward: "博多区",
        poster_status: "done",
        reported_by: "たろう",
        note: "ポスターが破れている",
      }),
    ]);
  });

  test("ボランティア・一覧にない人は集計を読めない", async () => {
    const { client: volunteer } = await signInVolunteer("たろう");
    expect((await volunteer.rpc("admin_sticker_progress")).error).not.toBeNull();
    expect((await volunteer.rpc("admin_sticker_issues")).error).not.toBeNull();
    const { client: stranger } = await signInStaff(null);
    expect((await stranger.rpc("admin_sticker_progress")).error?.message).toBe("not_admin");
  });
});

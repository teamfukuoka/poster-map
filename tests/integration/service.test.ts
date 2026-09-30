import { buildPublicBoardsResponse } from "@/features/poster-map/public-api";
import {
  getViewer,
  joinAsVolunteer,
  loadBoardsForVolunteer,
  loadHistory,
  loadMyBoardIds,
  updateStatus,
} from "@/features/poster-map/volunteer-service";
import {
  anonClient,
  insertBoard,
  resetDatabase,
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

describe("buildPublicBoardsResponse", () => {
  test("公開期間中は 200 と CDN キャッシュ", async () => {
    await insertBoard("A-1");
    const result = await buildPublicBoardsResponse(anonClient());
    expect(result.status).toBe(200);
    expect(result.cacheControl).toContain("s-maxage=30");
    expect(result.body).toEqual({
      boards: [expect.objectContaining({ number: "A-1", ward: "中央区", status: "not_yet" })],
    });
  });

  test("公開期間外は 404", async () => {
    await insertBoard("A-1");
    await setPublicWindow("hidden");
    const result = await buildPublicBoardsResponse(anonClient());
    expect(result).toEqual({
      status: 404,
      cacheControl: "public, max-age=0, s-maxage=30",
      body: { error: "closed" },
    });
  });
});

describe("getViewer", () => {
  test("未ログインは public", async () => {
    expect(await getViewer(anonClient())).toEqual({ kind: "public" });
  });

  test("参加前の匿名ユーザーは public", async () => {
    const { client } = await signInAnon();
    expect(await getViewer(client)).toEqual({ kind: "public" });
  });

  test("参加済みは volunteer、停止されたら revoked", async () => {
    const { client, userId } = await signInVolunteer("はなこ");
    expect(await getViewer(client)).toEqual({ kind: "volunteer", displayName: "はなこ" });
    await revokeVolunteer(userId);
    expect(await getViewer(client)).toEqual({ kind: "revoked" });
  });
});

describe("joinAsVolunteer", () => {
  test("未ログインから匿名サインインして参加できる", async () => {
    const client = anonClient();
    const result = await joinAsVolunteer(client, ` ${TEST_INVITE_CODE} `, " じろう ");
    expect(result).toEqual({ ok: true, data: { displayName: "じろう" } });
    expect(await getViewer(client)).toEqual({ kind: "volunteer", displayName: "じろう" });
  });

  test("auth.users が消えた古いセッションが残っていても、匿名サインインし直して参加できる", async () => {
    const { client, userId } = await signInAnon();
    expect(await joinAsVolunteer(client, TEST_INVITE_CODE, "さぶろう")).toEqual({
      ok: true,
      data: { displayName: "さぶろう" },
    });
    // 運営が匿名ユーザーを掃除した。JWT はまだ有効なので getClaims は古い sub を返す
    await withPg((db) => db.query("delete from auth.users where id = $1", [userId]));

    const result = await joinAsVolunteer(client, TEST_INVITE_CODE, "さぶろう");
    expect(result).toEqual({ ok: true, data: { displayName: "さぶろう" } });
    const rows = await withPg(
      async (db) => (await db.query("select user_id from public.volunteers")).rows,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].user_id).not.toBe(userId);
  });

  test("参加コードが違えば利用者向けの文言を返す", async () => {
    const result = await joinAsVolunteer(anonClient(), "wrong", "じろう");
    expect(result).toEqual({ ok: false, error: "参加コードが正しくありません。" });
  });

  test("参加コードを続けて間違えると、正しいコードでも受け付けない", async () => {
    const client = anonClient();
    for (let i = 0; i < 5; i++) {
      expect(await joinAsVolunteer(client, `wrong-${i}`, "じろう")).toEqual({
        ok: false,
        error: "参加コードが正しくありません。",
      });
    }
    expect(await joinAsVolunteer(client, TEST_INVITE_CODE, "じろう")).toEqual({
      ok: false,
      error:
        "参加コードの入力に続けて失敗したため、受付を一時停止しています。15分ほどたってから、もう一度お試しください。",
    });
    expect(await getViewer(client)).toEqual({ kind: "public" });
  });

  test("ニックネームが長すぎれば DB を呼ばずに断る", async () => {
    const client = anonClient();
    const result = await joinAsVolunteer(client, TEST_INVITE_CODE, "あ".repeat(21));
    expect(result).toEqual({ ok: false, error: "ニックネームは1〜20文字で入力してください。" });
    expect((await client.auth.getSession()).data.session).toBeNull();
  });
});

describe("報告と履歴", () => {
  test("ボランティアは公開期間外でも一覧を読める", async () => {
    await insertBoard("A-1");
    await setPublicWindow("before");
    const { client } = await signInVolunteer("はなこ");
    const result = await loadBoardsForVolunteer(client);
    expect(result.ok && result.data.map((b) => b.number)).toEqual(["A-1"]);
  });

  test("更新すると掲示板・履歴・自分の更新一覧に反映される", async () => {
    const boardId = await insertBoard("A-1");
    await insertBoard("A-2");
    const { client } = await signInVolunteer("はなこ");

    const updated = await updateStatus(client, { boardId, status: "done", note: " 貼りました " });
    expect(updated).toEqual({
      ok: true,
      data: expect.objectContaining({ id: boardId, number: "A-1", status: "done" }),
    });

    const history = await loadHistory(client, boardId);
    expect(history).toEqual({
      ok: true,
      data: [
        expect.objectContaining({
          previousStatus: "not_yet",
          newStatus: "done",
          displayName: "はなこ",
          note: "貼りました",
        }),
      ],
    });
    expect(await loadMyBoardIds(client)).toEqual({ ok: true, data: [boardId] });
  });

  test("不正なステータス・長すぎる連絡事項・参加していない人は断る", async () => {
    const boardId = await insertBoard("A-1");
    const { client } = await signInVolunteer("はなこ");
    expect(await updateStatus(client, { boardId, status: "error_damaged", note: "" })).toEqual({
      ok: false,
      error: "エラーが発生しました。時間をおいてもう一度お試しください。",
    });
    expect(await updateStatus(client, { boardId, status: "done", note: "あ".repeat(501) })).toEqual(
      { ok: false, error: "連絡事項は500文字以内で入力してください。" },
    );
    const { client: stranger } = await signInAnon();
    expect(await updateStatus(stranger, { boardId, status: "done", note: "" })).toEqual({
      ok: false,
      error: "報告するには参加の手続きが必要です。",
    });
  });
});

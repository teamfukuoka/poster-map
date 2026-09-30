/** @jest-environment node */
import { fetchPublicBoards } from "./public-boards";

function fakeFetch(status: number, body: unknown) {
  return (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
}

test("200 なら掲示板を返す", async () => {
  const boards = [{ id: "1" }];
  await expect(fetchPublicBoards(fakeFetch(200, { boards }))).resolves.toEqual({
    kind: "ok",
    boards,
  });
});

test("404 は公開期間外", async () => {
  await expect(fetchPublicBoards(fakeFetch(404, { error: "not_public" }))).resolves.toEqual({
    kind: "closed",
  });
});

test("それ以外はエラー", async () => {
  await expect(fetchPublicBoards(fakeFetch(503, {}))).resolves.toEqual({
    kind: "error",
    message: "地図のデータを読み込めませんでした。時間をおいて再読み込みしてください。",
  });
});

test("通信に失敗してもエラーとして返す", async () => {
  const failing = (async () => {
    throw new TypeError("network");
  }) as unknown as typeof fetch;
  await expect(fetchPublicBoards(failing)).resolves.toMatchObject({ kind: "error" });
});

import { createClient } from "@/lib/supabase/server";
import { joinAction, loadHistoryAction, updateStatusAction } from "./actions";
import { FALLBACK_MESSAGE } from "./errors";
import * as service from "./volunteer-service";

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }));
jest.mock("./volunteer-service", () => ({
  joinAsVolunteer: jest.fn(),
  loadHistory: jest.fn(),
  updateStatus: jest.fn(),
}));

const client = { fake: true };
const invalid = { ok: false as const, error: FALLBACK_MESSAGE };

beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(createClient).mockResolvedValue(client as never);
});

// Server Action はブラウザから任意の値で呼べるので、型どおりとは限らない
const call = <T>(fn: (...args: never[]) => T, ...args: unknown[]) =>
  (fn as (...args: unknown[]) => T)(...args);

describe("joinAction", () => {
  test("文字列なら service に渡す", async () => {
    jest
      .mocked(service.joinAsVolunteer)
      .mockResolvedValue({ ok: true, data: { displayName: "a" } });
    await expect(joinAction("code", "a")).resolves.toEqual({
      ok: true,
      data: { displayName: "a" },
    });
    expect(service.joinAsVolunteer).toHaveBeenCalledWith(client, "code", "a");
  });

  test.each([
    [123, "a"],
    ["code", null],
    [undefined, undefined],
    [{}, "a"],
  ])("文字列でなければ失敗を返す（%p, %p）", async (code, name) => {
    await expect(call(joinAction, code, name)).resolves.toEqual(invalid);
    expect(service.joinAsVolunteer).not.toHaveBeenCalled();
    expect(createClient).not.toHaveBeenCalled();
  });
});

describe("loadHistoryAction", () => {
  test("文字列なら service に渡す", async () => {
    jest.mocked(service.loadHistory).mockResolvedValue({ ok: true, data: [] });
    await expect(loadHistoryAction("b1")).resolves.toEqual({ ok: true, data: [] });
    expect(service.loadHistory).toHaveBeenCalledWith(client, "b1");
  });

  test.each([[1], [null], [["b1"]]])("文字列でなければ失敗を返す（%p）", async (boardId) => {
    await expect(call(loadHistoryAction, boardId)).resolves.toEqual(invalid);
    expect(service.loadHistory).not.toHaveBeenCalled();
  });
});

describe("updateStatusAction", () => {
  const input = { boardId: "b1", status: "done", note: "" };

  test("正しい形なら service に渡す", async () => {
    jest.mocked(service.updateStatus).mockResolvedValue(invalid);
    await updateStatusAction(input);
    expect(service.updateStatus).toHaveBeenCalledWith(client, input);
  });

  test.each([
    [null],
    ["b1"],
    [{ ...input, boardId: 1 }],
    [{ ...input, status: null }],
    [{ ...input, note: undefined }],
    [{ boardId: "b1", status: "done" }],
  ])("形が違えば失敗を返す（%p）", async (value) => {
    await expect(call(updateStatusAction, value)).resolves.toEqual(invalid);
    expect(service.updateStatus).not.toHaveBeenCalled();
  });
});

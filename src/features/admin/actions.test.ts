import { revalidatePath, updateTag } from "next/cache";
import { FALLBACK_MESSAGE } from "@/features/poster-map/errors";
import { createClient } from "@/lib/supabase/server";
import {
  addMemberAction,
  publishSiteAction,
  registerInviteCodeAction,
  removeMemberAction,
  resetRehearsalAction,
  revealInviteCodeAction,
  revertAcceptanceAction,
  revokeInviteCodeAction,
  setForceHiddenAction,
} from "./actions";
import * as service from "./admin-service";

jest.mock("next/cache", () => ({ revalidatePath: jest.fn(), updateTag: jest.fn() }));
jest.mock("@/lib/site-name", () => ({ SITE_NAME_TAG: "site-name" }));
jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }));
jest.mock("./admin-service", () => ({
  revealInviteCode: jest.fn(),
  registerInviteCode: jest.fn(),
  revokeInviteCode: jest.fn(),
  setForceHidden: jest.fn(),
  publishSite: jest.fn(),
  revertAcceptance: jest.fn(),
  resetRehearsal: jest.fn(),
  addMember: jest.fn(),
  removeMember: jest.fn(),
}));

const client = { fake: true };
const invalid = { ok: false as const, error: FALLBACK_MESSAGE };
const failure = { ok: false as const, error: "失敗" };

beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(createClient).mockResolvedValue(client as never);
});

// Server Action はブラウザから任意の値で呼べるので、型どおりとは限らない
const call = <T>(fn: (...args: never[]) => T, ...args: unknown[]) =>
  (fn as (...args: unknown[]) => T)(...args);

describe("revealInviteCodeAction", () => {
  test("文字列なら service に渡し、revalidate しない", async () => {
    jest.mocked(service.revealInviteCode).mockResolvedValue({ ok: true, data: { code: "x" } });
    await expect(revealInviteCodeAction("id1")).resolves.toEqual({
      ok: true,
      data: { code: "x" },
    });
    expect(service.revealInviteCode).toHaveBeenCalledWith(client, "id1");
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  test.each([[1], [null], [undefined], [true]])("文字列でなければ失敗を返す（%p）", async (id) => {
    await expect(call(revealInviteCodeAction, id)).resolves.toEqual(invalid);
    expect(service.revealInviteCode).not.toHaveBeenCalled();
    expect(createClient).not.toHaveBeenCalled();
  });
});

describe("registerInviteCodeAction", () => {
  test("文字列なら service に渡し、成功したら revalidate する", async () => {
    jest.mocked(service.registerInviteCode).mockResolvedValue({ ok: true, data: null });
    await expect(registerInviteCodeAction("東区", "code")).resolves.toEqual({
      ok: true,
      data: null,
    });
    expect(service.registerInviteCode).toHaveBeenCalledWith(client, "東区", "code");
    expect(revalidatePath).toHaveBeenCalledWith("/admin", "layout");
  });

  test("失敗なら revalidate しない", async () => {
    jest.mocked(service.registerInviteCode).mockResolvedValue(failure);
    await expect(registerInviteCodeAction("東区", "code")).resolves.toEqual(failure);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  test.each([
    [123, "code"],
    ["東区", null],
    [undefined, undefined],
    ["東区", {}],
  ])("文字列でなければ失敗を返す（%p, %p）", async (label, code) => {
    await expect(call(registerInviteCodeAction, label, code)).resolves.toEqual(invalid);
    expect(service.registerInviteCode).not.toHaveBeenCalled();
  });
});

describe("revokeInviteCodeAction", () => {
  test("文字列と boolean なら service に渡し、成功したら revalidate する", async () => {
    jest
      .mocked(service.revokeInviteCode)
      .mockResolvedValue({ ok: true, data: { revokedVolunteers: 2 } });
    await expect(revokeInviteCodeAction("id1", true)).resolves.toEqual({
      ok: true,
      data: { revokedVolunteers: 2 },
    });
    expect(service.revokeInviteCode).toHaveBeenCalledWith(client, "id1", true);
    expect(revalidatePath).toHaveBeenCalledWith("/admin", "layout");
  });

  test("失敗なら revalidate しない", async () => {
    jest.mocked(service.revokeInviteCode).mockResolvedValue(failure);
    await expect(revokeInviteCodeAction("id1", false)).resolves.toEqual(failure);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  test.each([
    [1, true],
    ["id1", "true"],
    ["id1", 1],
    ["id1", null],
    ["id1", undefined],
    [undefined, false],
  ])("型が違えば失敗を返す（%p, %p）", async (id, flag) => {
    await expect(call(revokeInviteCodeAction, id, flag)).resolves.toEqual(invalid);
    expect(service.revokeInviteCode).not.toHaveBeenCalled();
  });
});

describe("setForceHiddenAction", () => {
  test("boolean なら service に渡し、成功したら revalidate する", async () => {
    jest.mocked(service.setForceHidden).mockResolvedValue({ ok: true, data: null });
    await expect(setForceHiddenAction(false)).resolves.toEqual({ ok: true, data: null });
    expect(service.setForceHidden).toHaveBeenCalledWith(client, false);
    expect(updateTag).toHaveBeenCalledWith("site-name");
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  test("失敗なら revalidate しない", async () => {
    jest.mocked(service.setForceHidden).mockResolvedValue(failure);
    await expect(setForceHiddenAction(true)).resolves.toEqual(failure);
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(updateTag).not.toHaveBeenCalled();
  });

  test.each([
    ["true"],
    [1],
    [0],
    [null],
    [undefined],
  ])("boolean でなければ失敗を返す（%p）", async (v) => {
    await expect(call(setForceHiddenAction, v)).resolves.toEqual(invalid);
    expect(service.setForceHidden).not.toHaveBeenCalled();
  });
});

describe.each([
  ["publishSiteAction", publishSiteAction, service.publishSite, "公開する"],
  ["revertAcceptanceAction", revertAcceptanceAction, service.revertAcceptance, "受理前に戻す"],
] as const)("%s", (_name, action, serviceFn, word) => {
  test("文字列なら service に渡し、成功したらサイト名の tag と公開の画面を revalidate する", async () => {
    jest.mocked(serviceFn).mockResolvedValue({ ok: true, data: null });
    await expect(action(word)).resolves.toEqual({ ok: true, data: null });
    expect(serviceFn).toHaveBeenCalledWith(client, word);
    expect(updateTag).toHaveBeenCalledWith("site-name");
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  test("失敗なら revalidate しない", async () => {
    jest.mocked(serviceFn).mockResolvedValue(failure);
    await expect(action(word)).resolves.toEqual(failure);
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(updateTag).not.toHaveBeenCalled();
  });

  test.each([[1], [null], [undefined], [true]])("文字列でなければ失敗を返す（%p）", async (v) => {
    await expect(call(action, v)).resolves.toEqual(invalid);
    expect(serviceFn).not.toHaveBeenCalled();
    expect(createClient).not.toHaveBeenCalled();
  });
});

describe("resetRehearsalAction", () => {
  test("文字列なら service に渡し、成功したら revalidate する", async () => {
    jest.mocked(service.resetRehearsal).mockResolvedValue({ ok: true, data: null });
    await expect(resetRehearsalAction("リセット")).resolves.toEqual({ ok: true, data: null });
    expect(service.resetRehearsal).toHaveBeenCalledWith(client, "リセット");
    expect(revalidatePath).toHaveBeenCalledWith("/admin", "layout");
  });

  test("失敗なら revalidate しない", async () => {
    jest.mocked(service.resetRehearsal).mockResolvedValue(failure);
    await expect(resetRehearsalAction("リセット")).resolves.toEqual(failure);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  test.each([[1], [null], [undefined], [true]])("文字列でなければ失敗を返す（%p）", async (v) => {
    await expect(call(resetRehearsalAction, v)).resolves.toEqual(invalid);
    expect(service.resetRehearsal).not.toHaveBeenCalled();
  });
});

describe("addMemberAction", () => {
  test.each([
    ["admin"],
    ["operator"],
  ] as const)("文字列と役割（%s）なら service に渡し、成功したら revalidate する", async (role) => {
    jest.mocked(service.addMember).mockResolvedValue({ ok: true, data: null });
    await expect(addMemberAction("a@example.invalid", role)).resolves.toEqual({
      ok: true,
      data: null,
    });
    expect(service.addMember).toHaveBeenCalledWith(client, "a@example.invalid", role);
    expect(revalidatePath).toHaveBeenCalledWith("/admin", "layout");
  });

  test("失敗なら revalidate しない", async () => {
    jest.mocked(service.addMember).mockResolvedValue(failure);
    await expect(addMemberAction("a@example.invalid", "operator")).resolves.toEqual(failure);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  test.each([
    [1, "admin"],
    ["a@example.invalid", "owner"],
    ["a@example.invalid", "Admin"],
    ["a@example.invalid", null],
    [undefined, "operator"],
  ])("型か役割が違えば失敗を返す（%p, %p）", async (email, role) => {
    await expect(call(addMemberAction, email, role)).resolves.toEqual(invalid);
    expect(service.addMember).not.toHaveBeenCalled();
    expect(createClient).not.toHaveBeenCalled();
  });
});

describe("removeMemberAction", () => {
  test("文字列なら service に渡し、成功したら revalidate する", async () => {
    jest.mocked(service.removeMember).mockResolvedValue({ ok: true, data: null });
    await expect(removeMemberAction("a@example.invalid")).resolves.toEqual({
      ok: true,
      data: null,
    });
    expect(service.removeMember).toHaveBeenCalledWith(client, "a@example.invalid");
    expect(revalidatePath).toHaveBeenCalledWith("/admin", "layout");
  });

  test("失敗なら revalidate しない", async () => {
    jest.mocked(service.removeMember).mockResolvedValue(failure);
    await expect(removeMemberAction("a@example.invalid")).resolves.toEqual(failure);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  test.each([[1], [null], [undefined], [{}]])("文字列でなければ失敗を返す（%p）", async (email) => {
    await expect(call(removeMemberAction, email)).resolves.toEqual(invalid);
    expect(service.removeMember).not.toHaveBeenCalled();
  });
});

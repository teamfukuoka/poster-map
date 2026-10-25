import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logoutAction } from "./auth-actions";

jest.mock("next/navigation", () => ({ redirect: jest.fn() }));
jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }));

const signOut = jest.fn();

beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(createClient).mockResolvedValue({ auth: { signOut } } as never);
});

describe("logoutAction", () => {
  test("signOut が成功したら、ログイン画面へ移る", async () => {
    signOut.mockResolvedValue({ error: null });
    await logoutAction();
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(redirect).toHaveBeenCalledWith("/admin/login");
  });

  test("signOut が失敗しても、この端末の Cookie を消してからログイン画面へ移る", async () => {
    signOut.mockResolvedValueOnce({ error: { name: "AuthRetryableFetchError" } });
    signOut.mockResolvedValueOnce({ error: null });
    await logoutAction();
    expect(signOut).toHaveBeenNthCalledWith(2, { scope: "local" });
    expect(redirect).toHaveBeenCalledWith("/admin/login");
  });
});

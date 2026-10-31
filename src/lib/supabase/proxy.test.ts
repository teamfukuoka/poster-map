/** @jest-environment node */
import { createServerClient } from "@supabase/ssr";
import { NextRequest } from "next/server";
import { STAFF_AUTH_COOKIE } from "./cookie-names";
import { updateSession } from "./proxy";

jest.mock("@supabase/ssr", () => ({ createServerClient: jest.fn() }));
jest.mock("./env", () => ({
  supabaseEnv: () => ({ url: "http://supabase.test", anonKey: "anon" }),
}));

type Options = {
  cookieOptions?: { name: string };
  cookies: { setAll: (cookies: { name: string; value: string; options: object }[]) => void };
};

/** getClaims のときに、そのクライアントの Cookie 名で書き込む（更新されたふり） */
function refreshWrites(written: Record<string, string>) {
  jest.mocked(createServerClient).mockImplementation(((
    _url: string,
    _key: string,
    options: Options,
  ) => ({
    auth: {
      getClaims: async () => {
        const name = options.cookieOptions?.name ?? "sb-default-auth-token";
        if (written[name]) {
          options.cookies.setAll([{ name, value: written[name], options: { path: "/" } }]);
        }
        return { data: null, error: null };
      },
    },
  })) as never);
}

beforeEach(() => jest.resetAllMocks());

test("ボランティアと管理画面の両方のセッションを更新し、両方の Cookie を返す", async () => {
  refreshWrites({ "sb-default-auth-token": "volunteer", [STAFF_AUTH_COOKIE]: "staff" });
  const response = await updateSession(new NextRequest("http://localhost/admin"));
  expect(response.cookies.get("sb-default-auth-token")?.value).toBe("volunteer");
  expect(response.cookies.get(STAFF_AUTH_COOKIE)?.value).toBe("staff");
  const names = jest
    .mocked(createServerClient)
    .mock.calls.map(([, , options]) => options?.cookieOptions?.name);
  expect(names).toEqual([undefined, STAFF_AUTH_COOKIE]);
});

test("片方だけ更新されたら、その Cookie だけを返す", async () => {
  refreshWrites({ "sb-default-auth-token": "volunteer" });
  const response = await updateSession(new NextRequest("http://localhost/"));
  expect(response.cookies.get("sb-default-auth-token")?.value).toBe("volunteer");
  expect(response.cookies.get(STAFF_AUTH_COOKIE)).toBeUndefined();
});

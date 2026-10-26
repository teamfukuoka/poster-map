/** @jest-environment node */
import { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import { proxy } from "./proxy";

jest.mock("@/lib/supabase/proxy", () => ({
  updateSession: jest.fn(async () => new Response("next")),
}));

const saved = { ...process.env };
afterEach(() => {
  process.env = { ...saved };
  jest.mocked(updateSession).mockClear();
});

test("本番・ローカルは認証なしでセッション更新へ進む", async () => {
  delete process.env.VERCEL_ENV;
  await proxy(new NextRequest("https://example.invalid/admin"));
  expect(updateSession).toHaveBeenCalled();
});

test("Preview は認証がなければセッション更新の前に 401", async () => {
  process.env.VERCEL_ENV = "preview";
  process.env.PREVIEW_BASIC_AUTH_USER = "staff";
  process.env.PREVIEW_BASIC_AUTH_PASSWORD = "pass-1234!";
  const response = await proxy(new NextRequest("https://example.invalid/auth/callback?code=x"));
  expect(response.status).toBe(401);
  expect(updateSession).not.toHaveBeenCalled();
});

test("Preview で認証済みならセッション更新へ進む", async () => {
  process.env.VERCEL_ENV = "preview";
  process.env.PREVIEW_BASIC_AUTH_USER = "staff";
  process.env.PREVIEW_BASIC_AUTH_PASSWORD = "pass-1234!";
  const authorization = `Basic ${Buffer.from("staff:pass-1234!").toString("base64")}`;
  await proxy(new NextRequest("https://example.invalid/", { headers: { authorization } }));
  expect(updateSession).toHaveBeenCalled();
});

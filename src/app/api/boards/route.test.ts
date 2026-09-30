/**
 * @jest-environment node
 */
import { buildPublicBoardsResponse } from "@/features/poster-map/public-api";
import { createPublicClient } from "@/lib/supabase/public";
import { GET } from "./route";

jest.mock("@/lib/supabase/public", () => ({ createPublicClient: jest.fn(() => ({})) }));
jest.mock("@/features/poster-map/public-api", () => ({
  ...jest.requireActual("@/features/poster-map/public-api"),
  buildPublicBoardsResponse: jest.fn(),
}));

beforeEach(() => {
  jest.mocked(buildPublicBoardsResponse).mockReset();
  jest.mocked(createPublicClient).mockClear();
});

test("クエリ文字列なしは DB から作った中身をそのまま返す", async () => {
  jest.mocked(buildPublicBoardsResponse).mockResolvedValue({
    status: 200,
    cacheControl: "public, max-age=0, s-maxage=30, stale-while-revalidate=30",
    body: { boards: [] },
  });
  const response = await GET(new Request("https://example.invalid/api/boards"));
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe(
    "public, max-age=0, s-maxage=30, stale-while-revalidate=30",
  );
  expect(await response.json()).toEqual({ boards: [] });
});

test.each([
  "?t=1",
  "?boards",
  "?a=1&b=2",
])("クエリ文字列付き（%s）は Supabase に触れずに 400", async (query) => {
  const response = await GET(new Request(`https://example.invalid/api/boards${query}`));
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ error: "bad_request" });
  expect(createPublicClient).not.toHaveBeenCalled();
  expect(buildPublicBoardsResponse).not.toHaveBeenCalled();
});

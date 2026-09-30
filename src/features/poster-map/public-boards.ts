import type { MapBoard } from "./types";

export type PublicBoardsResult =
  | { kind: "ok"; boards: MapBoard[] }
  | { kind: "closed" }
  | { kind: "error"; message: string };

const LOAD_ERROR = "地図のデータを読み込めませんでした。時間をおいて再読み込みしてください。";

export async function fetchPublicBoards(
  fetchImpl: typeof fetch = fetch,
): Promise<PublicBoardsResult> {
  try {
    const response = await fetchImpl("/api/boards");
    if (response.status === 404) return { kind: "closed" };
    if (!response.ok) return { kind: "error", message: LOAD_ERROR };
    const body = (await response.json()) as { boards: MapBoard[] };
    return { kind: "ok", boards: body.boards };
  } catch {
    return { kind: "error", message: LOAD_ERROR };
  }
}

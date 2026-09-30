import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  loadHistoryAction,
  loadMyBoardIdsAction,
  loadVolunteerBoardsAction,
  updateStatusAction,
} from "../actions";
import { FALLBACK_MESSAGE } from "../errors";
import { fetchPublicBoards } from "../public-boards";
import type { MapBoard } from "../types";
import { PosterMapApp } from "./poster-map-app";

jest.mock("next/dynamic", () => () => {
  function MockMap(props: {
    boards: MapBoard[];
    onBoardClick: (b: MapBoard) => void;
    controls?: React.ReactNode;
  }) {
    return (
      <div>
        <p data-testid="map-count">{props.boards.length}</p>
        {props.boards.map((b) => (
          <button key={b.id} type="button" onClick={() => props.onBoardClick(b)}>
            pin-{b.number}
          </button>
        ))}
        {props.controls}
      </div>
    );
  }
  return MockMap;
});
jest.mock("../actions", () => ({
  joinAction: jest.fn(),
  loadHistoryAction: jest.fn(),
  loadMyBoardIdsAction: jest.fn(),
  loadVolunteerBoardsAction: jest.fn(),
  updateStatusAction: jest.fn(),
}));
jest.mock("../public-boards", () => ({ fetchPublicBoards: jest.fn() }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const board = (id: string, status: MapBoard["status"] = "not_yet"): MapBoard => ({
  id,
  number: id,
  name: `掲示板${id}`,
  address: "中央区天神",
  ward: "中央区",
  lat: 33.59,
  long: 130.4,
  status,
});

beforeEach(() => jest.clearAllMocks());

test("一般の人には公開 API の掲示板を出し、押すと情報ダイアログを開く", async () => {
  jest
    .mocked(fetchPublicBoards)
    .mockResolvedValue({ kind: "ok", boards: [board("1"), board("2", "done")] });
  render(<PosterMapApp initialViewer={{ kind: "public" }} />);
  expect(await screen.findByTestId("map-count")).toHaveTextContent("2");
  expect(screen.getByTestId("summary-percent")).toHaveTextContent("50");
  fireEvent.click(screen.getByRole("button", { name: "pin-1" }));
  expect(await screen.findByText("掲示板の情報")).toBeInTheDocument();
  expect(loadVolunteerBoardsAction).not.toHaveBeenCalled();
});

test("公開期間外は案内を出す", async () => {
  jest.mocked(fetchPublicBoards).mockResolvedValue({ kind: "closed" });
  render(<PosterMapApp initialViewer={{ kind: "public" }} />);
  expect(await screen.findByText("地図は公開期間中にご覧いただけます。")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "参加コードをお持ちの方" })).toBeInTheDocument();
});

test("停止された端末には参加の案内を出さない", async () => {
  jest.mocked(fetchPublicBoards).mockResolvedValue({ kind: "closed" });
  render(<PosterMapApp initialViewer={{ kind: "revoked" }} />);
  expect(await screen.findByText("地図は公開期間中にご覧いただけます。")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "参加コードをお持ちの方" })).not.toBeInTheDocument();
});

test("ボランティアは報告でき、結果が地図と集計に反映される", async () => {
  jest.mocked(loadVolunteerBoardsAction).mockResolvedValue({ ok: true, data: [board("1")] });
  jest.mocked(loadMyBoardIdsAction).mockResolvedValue({ ok: true, data: [] });
  jest.mocked(loadHistoryAction).mockResolvedValue({ ok: true, data: [] });
  jest.mocked(updateStatusAction).mockResolvedValue({ ok: true, data: board("1", "done") });
  render(<PosterMapApp initialViewer={{ kind: "volunteer", displayName: "はなこ" }} />);
  expect(await screen.findByText("はなこ さんとして参加中")).toBeInTheDocument();
  fireEvent.click(await screen.findByRole("button", { name: "pin-1" }));
  fireEvent.click(await screen.findByRole("button", { name: "報告する" }));
  await waitFor(() => expect(screen.getByTestId("summary-percent")).toHaveTextContent("100"));
  expect(fetchPublicBoards).not.toHaveBeenCalled();
});

test("読み込みに失敗したら再読み込みできる", async () => {
  jest
    .mocked(fetchPublicBoards)
    .mockResolvedValueOnce({ kind: "error", message: "読み込めませんでした" })
    .mockResolvedValueOnce({ kind: "ok", boards: [board("1")] });
  render(<PosterMapApp initialViewer={{ kind: "public" }} />);
  expect(await screen.findByRole("alert")).toHaveTextContent("読み込めませんでした");
  fireEvent.click(screen.getByRole("button", { name: "もう一度読み込む" }));
  expect(await screen.findByTestId("map-count")).toHaveTextContent("1");
});

test("ボランティアの読み込みが reject されたら、再読み込みを出す", async () => {
  jest
    .mocked(loadVolunteerBoardsAction)
    .mockRejectedValueOnce(new Error("network"))
    .mockResolvedValueOnce({ ok: true, data: [board("1")] });
  jest.mocked(loadMyBoardIdsAction).mockResolvedValue({ ok: true, data: [] });
  render(<PosterMapApp initialViewer={{ kind: "volunteer", displayName: "はなこ" }} />);
  expect(await screen.findByRole("alert")).toHaveTextContent(FALLBACK_MESSAGE);
  fireEvent.click(screen.getByRole("button", { name: "もう一度読み込む" }));
  expect(await screen.findByTestId("map-count")).toHaveTextContent("1");
});

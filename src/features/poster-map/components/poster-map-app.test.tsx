import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  joinAction,
  loadHistoryAction,
  loadMyBoardIdsAction,
  loadMyReservedBoardIdsAction,
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
  loadMyReservedBoardIdsAction: jest.fn(),
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

// mockResolvedValueOnce の残りが次のテストに漏れないよう、実装ごと戻す
beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(loadMyReservedBoardIdsAction).mockResolvedValue({ ok: true, data: [] });
});

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

test("サーバーで期間外と分かっていれば、最初から案内を出し、公開 API を呼ばない", () => {
  render(<PosterMapApp initialViewer={{ kind: "public" }} initialClosed />);
  expect(screen.getByText("地図は公開期間中にご覧いただけます。")).toBeInTheDocument();
  expect(screen.queryByText("読み込み中…")).not.toBeInTheDocument();
  expect(fetchPublicBoards).not.toHaveBeenCalled();
});

test("期間外でも、ボランティアには地図を出す", async () => {
  jest.mocked(loadVolunteerBoardsAction).mockResolvedValue({ ok: true, data: [board("1")] });
  jest.mocked(loadMyBoardIdsAction).mockResolvedValue({ ok: true, data: [] });
  render(
    <PosterMapApp initialViewer={{ kind: "volunteer", displayName: "はなこ" }} initialClosed />,
  );
  expect(await screen.findByTestId("map-count")).toHaveTextContent("1");
  expect(fetchPublicBoards).not.toHaveBeenCalled();
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

test("報告が終わる前に別の掲示板を開いていたら、そのダイアログは閉じない", async () => {
  jest
    .mocked(loadVolunteerBoardsAction)
    .mockResolvedValue({ ok: true, data: [board("1"), board("2")] });
  jest.mocked(loadMyBoardIdsAction).mockResolvedValue({ ok: true, data: [] });
  jest.mocked(loadHistoryAction).mockResolvedValue({ ok: true, data: [] });
  let resolveUpdate: (value: Awaited<ReturnType<typeof updateStatusAction>>) => void = () => {};
  jest.mocked(updateStatusAction).mockReturnValue(
    new Promise((resolve) => {
      resolveUpdate = resolve;
    }),
  );
  render(<PosterMapApp initialViewer={{ kind: "volunteer", displayName: "はなこ" }} />);
  fireEvent.click(await screen.findByRole("button", { name: "pin-1" }));
  fireEvent.click(await screen.findByRole("button", { name: "報告する" }));
  fireEvent.click(screen.getByRole("button", { name: "pin-2", hidden: true }));
  expect(await screen.findByText("#2 掲示板2")).toBeInTheDocument();
  resolveUpdate({ ok: true, data: board("1", "done") });
  await waitFor(() => expect(screen.getByTestId("summary-percent")).toHaveTextContent("50"));
  expect(screen.getByText("#2 掲示板2")).toBeInTheDocument();
});

function fillJoin() {
  fireEvent.change(screen.getByLabelText("参加コード"), { target: { value: "code-1" } });
  fireEvent.change(screen.getByLabelText("ニックネーム"), { target: { value: "はなこ" } });
  fireEvent.click(screen.getByRole("button", { name: "参加する" }));
}

test("ピンから参加したら、地図を作り直さずにその掲示板の報告を開く", async () => {
  jest
    .mocked(fetchPublicBoards)
    .mockResolvedValue({ kind: "ok", boards: [board("1"), board("2")] });
  jest.mocked(joinAction).mockResolvedValue({ ok: true, data: { displayName: "はなこ" } });
  let resolveBoards: (value: Awaited<ReturnType<typeof loadVolunteerBoardsAction>>) => void =
    () => {};
  jest.mocked(loadVolunteerBoardsAction).mockReturnValue(
    new Promise((resolve) => {
      resolveBoards = resolve;
    }),
  );
  jest.mocked(loadMyBoardIdsAction).mockResolvedValue({ ok: true, data: [] });
  jest.mocked(loadHistoryAction).mockResolvedValue({ ok: true, data: [] });
  render(<PosterMapApp initialViewer={{ kind: "public" }} />);
  fireEvent.click(await screen.findByRole("button", { name: "pin-1" }));
  fireEvent.click(await screen.findByRole("button", { name: "参加コードをお持ちの方" }));
  fillJoin();
  expect(await screen.findByText("ポスターの状況を報告")).toBeInTheDocument();
  expect(screen.getByText("#1 掲示板1")).toBeInTheDocument();
  // 取り直している間も、地図はそのまま
  expect(screen.getByTestId("map-count")).toHaveTextContent("2");
  resolveBoards({ ok: true, data: [board("1"), board("2"), board("3")] });
  await waitFor(() => expect(screen.getByTestId("map-count")).toHaveTextContent("3"));
});

test("参加をやめた後に上のボタンから参加したら、報告は開かない", async () => {
  jest.mocked(fetchPublicBoards).mockResolvedValue({ kind: "ok", boards: [board("1")] });
  jest.mocked(joinAction).mockResolvedValue({ ok: true, data: { displayName: "はなこ" } });
  jest.mocked(loadVolunteerBoardsAction).mockResolvedValue({ ok: true, data: [board("1")] });
  jest.mocked(loadMyBoardIdsAction).mockResolvedValue({ ok: true, data: [] });
  render(<PosterMapApp initialViewer={{ kind: "public" }} />);
  fireEvent.click(await screen.findByRole("button", { name: "pin-1" }));
  fireEvent.click(await screen.findByRole("button", { name: "参加コードをお持ちの方" }));
  fireEvent.click(await screen.findByRole("button", { name: "キャンセル" }));
  fireEvent.click(await screen.findByRole("button", { name: "参加コードをお持ちの方" }));
  fillJoin();
  expect(await screen.findByText("はなこ さんとして参加中")).toBeInTheDocument();
  await waitFor(() => expect(loadVolunteerBoardsAction).toHaveBeenCalled());
  expect(screen.queryByText("ポスターの状況を報告")).not.toBeInTheDocument();
});

test("期間外の案内から参加したら、ボランティアの地図を読み込む", async () => {
  jest.mocked(joinAction).mockResolvedValue({ ok: true, data: { displayName: "はなこ" } });
  jest.mocked(loadVolunteerBoardsAction).mockResolvedValue({ ok: true, data: [board("1")] });
  jest.mocked(loadMyBoardIdsAction).mockResolvedValue({ ok: true, data: [] });
  render(<PosterMapApp initialViewer={{ kind: "public" }} initialClosed />);
  fireEvent.click(screen.getByRole("button", { name: "参加コードをお持ちの方" }));
  fillJoin();
  expect(await screen.findByTestId("map-count")).toHaveTextContent("1");
  expect(fetchPublicBoards).not.toHaveBeenCalled();
});

function returnToTab() {
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  fireEvent(document, new Event("visibilitychange"));
}

test("ボランティアはタブに戻ったとき、地図を残したまま掲示板を取り直す", async () => {
  jest
    .mocked(loadVolunteerBoardsAction)
    .mockResolvedValueOnce({ ok: true, data: [board("1")] })
    .mockResolvedValueOnce({ ok: true, data: [board("1"), board("2")] });
  jest.mocked(loadMyBoardIdsAction).mockResolvedValue({ ok: true, data: [] });
  render(<PosterMapApp initialViewer={{ kind: "volunteer", displayName: "はなこ" }} />);
  expect(await screen.findByTestId("map-count")).toHaveTextContent("1");
  returnToTab();
  expect(screen.getByTestId("map-count")).toHaveTextContent("1");
  await waitFor(() => expect(screen.getByTestId("map-count")).toHaveTextContent("2"));
});

test("タブに戻ったときの取り直しに失敗しても、今の表示を残す", async () => {
  jest
    .mocked(loadVolunteerBoardsAction)
    .mockResolvedValueOnce({ ok: true, data: [board("1")] })
    .mockRejectedValueOnce(new Error("network"));
  jest.mocked(loadMyBoardIdsAction).mockResolvedValue({ ok: true, data: [] });
  render(<PosterMapApp initialViewer={{ kind: "volunteer", displayName: "はなこ" }} />);
  expect(await screen.findByTestId("map-count")).toHaveTextContent("1");
  returnToTab();
  await waitFor(() => expect(loadVolunteerBoardsAction).toHaveBeenCalledTimes(2));
  expect(screen.getByTestId("map-count")).toHaveTextContent("1");
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

test("一般の閲覧者はタブに戻っても取り直さない", async () => {
  jest.mocked(fetchPublicBoards).mockResolvedValue({ kind: "ok", boards: [board("1")] });
  render(<PosterMapApp initialViewer={{ kind: "public" }} />);
  expect(await screen.findByTestId("map-count")).toHaveTextContent("1");
  returnToTab();
  expect(fetchPublicBoards).toHaveBeenCalledTimes(1);
});

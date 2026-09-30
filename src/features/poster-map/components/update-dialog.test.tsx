import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { loadHistoryAction, updateStatusAction } from "../actions";
import type { MapBoard } from "../types";
import { UpdateDialog } from "./update-dialog";

jest.mock("../actions", () => ({ loadHistoryAction: jest.fn(), updateStatusAction: jest.fn() }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
const mockedHistory = jest.mocked(loadHistoryAction);
const mockedUpdate = jest.mocked(updateStatusAction);

const board: MapBoard = {
  id: "b1",
  number: "1-1",
  name: "天神公園",
  address: "中央区天神1丁目",
  ward: "中央区",
  lat: 33.59,
  long: 130.4,
  status: "not_yet",
};

beforeEach(() => {
  mockedHistory.mockReset();
  mockedUpdate.mockReset();
});

test("履歴を読み込んで表示する", async () => {
  mockedHistory.mockResolvedValue({
    ok: true,
    data: [
      {
        id: "h1",
        previousStatus: "not_yet",
        newStatus: "reserved",
        displayName: "はなこ",
        note: "明日行きます",
        createdAt: "2026-11-02T01:00:00Z",
      },
    ],
  });
  render(<UpdateDialog board={board} onClose={jest.fn()} onUpdated={jest.fn()} />);
  expect(await screen.findByText(/未貼付 → 予約/)).toBeInTheDocument();
  expect(screen.getByText(/はなこ/)).toBeInTheDocument();
  expect(screen.getByText(/「明日行きます」/)).toBeInTheDocument();
  expect(mockedHistory).toHaveBeenCalledWith("b1");
});

test("報告すると更新後の掲示板を onUpdated に渡す", async () => {
  mockedHistory.mockResolvedValue({ ok: true, data: [] });
  const updated = { ...board, status: "done" as const };
  mockedUpdate.mockResolvedValue({ ok: true, data: updated });
  const onUpdated = jest.fn();
  render(<UpdateDialog board={board} onClose={jest.fn()} onUpdated={onUpdated} />);
  await screen.findByText("履歴はまだありません");
  fireEvent.change(screen.getByLabelText("連絡事項（任意）"), { target: { value: "メモ" } });
  fireEvent.click(screen.getByRole("button", { name: "報告する" }));
  await waitFor(() => expect(onUpdated).toHaveBeenCalledWith(updated));
  expect(mockedUpdate).toHaveBeenCalledWith({ boardId: "b1", status: "not_yet", note: "メモ" });
});

test("失敗したら理由を出す", async () => {
  mockedHistory.mockResolvedValue({ ok: true, data: [] });
  mockedUpdate.mockResolvedValue({ ok: false, error: "報告するには参加の手続きが必要です。" });
  render(<UpdateDialog board={board} onClose={jest.fn()} onUpdated={jest.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "報告する" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("参加の手続きが必要です");
});

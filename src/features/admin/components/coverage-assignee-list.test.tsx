import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { toast } from "sonner";
import { deleteCoverageAssigneeAction, updateCoverageAssigneeAction } from "../actions";
import { buildPlaces } from "../coverage-view";
import { CoverageAssigneeList } from "./coverage-assignee-list";
import { assignee, range, SUMMARY } from "./coverage-fixtures";

jest.mock("../actions", () => ({
  updateCoverageAssigneeAction: jest.fn(),
  deleteCoverageAssigneeAction: jest.fn(),
}));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
const mockedDelete = jest.mocked(deleteCoverageAssigneeAction);
const mockedUpdate = jest.mocked(updateCoverageAssigneeAction);

const places = buildPlaces(SUMMARY);
const A = assignee("a1", "A班", [range({ kind: "town", ward: "東区", town: "馬出" })], {
  note: "土日のみ",
  board_count: 6,
  updated_at: "2026-10-28T00:00:00.111111+00:00",
});
const B = assignee("b1", "B班", [range({ kind: "school", school: "宮竹小" })], {
  board_count: 5,
  updated_at: "2026-10-28T00:00:00.222222+00:00",
});

beforeEach(() => {
  mockedDelete.mockReset();
  mockedUpdate.mockReset();
  jest.mocked(toast.success).mockReset();
});

function renderList(assignees = [A, B]) {
  return render(<CoverageAssigneeList assignees={assignees} places={places} />);
}

test("呼び名・範囲・掲示場の数・メモが出る", () => {
  renderList();
  const item = screen.getByText("A班").closest("li") as HTMLElement;
  expect(within(item).getByText("A班")).toBeInTheDocument();
  expect(within(item).getByText("東区 馬出")).toBeInTheDocument();
  expect(within(item).getByText("6か所")).toBeInTheDocument();
  expect(within(item).getByText("土日のみ")).toBeInTheDocument();
});

test("担当者がいなければ案内を出す", () => {
  renderList([]);
  expect(screen.getByText("登録した担当者がここに並びます。")).toBeInTheDocument();
});

test("検索欄で呼び名・地名で絞れる", () => {
  renderList();
  fireEvent.change(screen.getByLabelText("担当者を探す"), { target: { value: "宮竹" } });
  expect(screen.queryByText("A班")).not.toBeInTheDocument();
  expect(screen.getByText("B班")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("担当者を探す"), { target: { value: "A班" } });
  expect(screen.getByText("A班")).toBeInTheDocument();
  expect(screen.queryByText("B班")).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("担当者を探す"), { target: { value: "ない地名" } });
  expect(screen.getByText("見つかりませんでした。")).toBeInTheDocument();
});

test("「外す」は確認を挟み、id と updated_at を文字列のまま渡す", async () => {
  mockedDelete.mockResolvedValue({ ok: true, data: null });
  renderList();
  fireEvent.click(screen.getByRole("button", { name: "A班を外す" }));
  const dialog = await screen.findByRole("dialog");
  expect(mockedDelete).not.toHaveBeenCalled();
  await act(async () => {
    fireEvent.click(within(dialog).getByRole("button", { name: "外す" }));
  });
  expect(mockedDelete).toHaveBeenCalledWith("a1", "2026-10-28T00:00:00.111111+00:00");
  await waitFor(() => expect(toast.success).toHaveBeenCalledWith("外しました"));
});

test("「やめる」を押せば外さない", async () => {
  renderList();
  fireEvent.click(screen.getByRole("button", { name: "A班を外す" }));
  const dialog = await screen.findByRole("dialog");
  fireEvent.click(within(dialog).getByRole("button", { name: "やめる" }));
  expect(mockedDelete).not.toHaveBeenCalled();
});

test("外せなかったら理由を role=alert で出す", async () => {
  mockedDelete.mockResolvedValue({
    ok: false,
    error: "ほかの人が先に直しました。開き直してください",
  });
  renderList();
  fireEvent.click(screen.getByRole("button", { name: "B班を外す" }));
  const dialog = await screen.findByRole("dialog");
  await act(async () => {
    fireEvent.click(within(dialog).getByRole("button", { name: "外す" }));
  });
  expect(await screen.findByRole("alert")).toHaveTextContent("ほかの人が先に直しました");
  expect(mockedDelete).toHaveBeenCalledWith("b1", "2026-10-28T00:00:00.222222+00:00");
});

test("「直す」はフォームを中身入りで開き、updateCoverageAssigneeAction を呼ぶ", async () => {
  mockedUpdate.mockResolvedValue({ ok: true, data: null });
  renderList();
  fireEvent.click(screen.getByRole("button", { name: "A班を直す" }));
  const label = screen.getByLabelText("呼び名");
  expect(label).toHaveValue("A班");
  expect(screen.getByLabelText("メモ")).toHaveValue("土日のみ");
  fireEvent.change(label, { target: { value: "A班2" } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "保存する" }));
  });
  expect(mockedUpdate).toHaveBeenCalledWith(
    "a1",
    "2026-10-28T00:00:00.111111+00:00",
    "A班2",
    "土日のみ",
    A.ranges,
  );
  // 保存できたらフォームは閉じる
  await waitFor(() => expect(screen.queryByLabelText("呼び名")).not.toBeInTheDocument());
});

test("直すのをやめられる", () => {
  renderList();
  fireEvent.click(screen.getByRole("button", { name: "A班を直す" }));
  fireEvent.click(screen.getByRole("button", { name: "やめる" }));
  expect(screen.queryByLabelText("呼び名")).not.toBeInTheDocument();
});

test("開いたまま一覧が更新されたら、直すフォームも新しい値で開き直す", () => {
  const { rerender } = renderList();
  fireEvent.click(screen.getByRole("button", { name: "A班を直す" }));
  expect(screen.getByLabelText("呼び名")).toHaveValue("A班");
  const updated = { ...A, label: "A班（直した）", updated_at: "2026-10-28T00:00:01.000000+00:00" };
  rerender(<CoverageAssigneeList assignees={[updated, B]} places={places} />);
  expect(screen.getByLabelText("呼び名")).toHaveValue("A班（直した）");
});

test("「外す」を同じ瞬間に二度押しても、action は 1 回しか呼ばれない", async () => {
  mockedDelete.mockReturnValue(new Promise(() => {}));
  renderList();
  fireEvent.click(screen.getByRole("button", { name: "A班を外す" }));
  const dialog = await screen.findByRole("dialog");
  const confirm = within(dialog).getByRole("button", { name: "外す" });
  await act(async () => {
    fireEvent.click(confirm);
    fireEvent.click(confirm);
  });
  expect(mockedDelete).toHaveBeenCalledTimes(1);
});

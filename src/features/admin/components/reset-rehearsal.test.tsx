import { act, fireEvent, render, screen } from "@testing-library/react";
import { resetRehearsalAction } from "../actions";
import { ResetRehearsal } from "./reset-rehearsal";

jest.mock("../actions", () => ({ resetRehearsalAction: jest.fn() }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

beforeEach(() => {
  jest.mocked(resetRehearsalAction).mockReset().mockResolvedValue({ ok: true, data: null });
});

test("締切を過ぎていれば、ボタンを出さず終わったことだけ出す", () => {
  render(<ResetRehearsal canReset={false} />);
  expect(screen.getByText("11月1日0:00を過ぎたため、この操作は終わりました。")).toBeInTheDocument();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});

test("締切前は、確認の文字「リセット」を入れると実行できる", async () => {
  render(<ResetRehearsal canReset />);
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "報告をまとめて戻す" }));
  });
  expect(screen.getByText(/元に戻せません。/)).toBeInTheDocument();
  const run = screen.getByRole("button", { name: "まとめて戻す" });
  expect(run).toBeDisabled();
  fireEvent.change(screen.getByLabelText(/「リセット」と入力/), { target: { value: "リセット" } });
  await act(async () => {
    fireEvent.click(run);
  });
  expect(resetRehearsalAction).toHaveBeenCalledWith("リセット");
});

test("サーバーが reset_closed を返したら、その文言を出す", async () => {
  jest.mocked(resetRehearsalAction).mockResolvedValue({
    ok: false,
    error: "11月1日0:00を過ぎたため、報告をまとめて戻すことはできません。",
  });
  render(<ResetRehearsal canReset />);
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "報告をまとめて戻す" }));
  });
  fireEvent.change(screen.getByLabelText(/「リセット」と入力/), { target: { value: "リセット" } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "まとめて戻す" }));
  });
  expect(screen.getByRole("alert")).toHaveTextContent("過ぎたため");
});

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { registerInviteCodeAction } from "../actions";
import { InviteCodeForm } from "./invite-code-form";

jest.mock("../actions", () => ({ registerInviteCodeAction: jest.fn() }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
const mockedRegister = jest.mocked(registerInviteCodeAction);

beforeEach(() => {
  mockedRegister.mockReset();
  jest.mocked(toast.success).mockReset();
});

function fill(label: string, code: string) {
  fireEvent.change(screen.getByLabelText("配布先の名前"), { target: { value: label } });
  fireEvent.change(screen.getByLabelText("参加コード"), { target: { value: code } });
}

test("記号のないコードは、ダイアログの前に文言を出す", () => {
  render(<InviteCodeForm />);
  fill("東区リーダー配布", "abcd1234");
  fireEvent.click(screen.getByRole("button", { name: "登録する" }));
  expect(screen.getByRole("alert")).toHaveTextContent("英字・数字・記号をそれぞれ1つ以上");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(mockedRegister).not.toHaveBeenCalled();
});

test("配布先の名前が空なら、ダイアログの前に文言を出す", () => {
  render(<InviteCodeForm />);
  fill("　 ", "abcd-1234");
  fireEvent.click(screen.getByRole("button", { name: "登録する" }));
  expect(screen.getByRole("alert")).toHaveTextContent("配布先の名前");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test("全角・前後の空白は正規化してから調べ、送る値は入力のまま", async () => {
  mockedRegister.mockResolvedValue({ ok: true, data: null });
  render(<InviteCodeForm />);
  fill(" 東区 ", "　ａｂｃｄ－１２３４　");
  fireEvent.click(screen.getByRole("button", { name: "登録する" }));
  const dialog = await screen.findByRole("dialog", { name: "この参加コードを登録しますか" });
  expect(dialog).toBeInTheDocument();
  await act(async () => {
    fireEvent.click(screen.getAllByRole("button", { name: "登録する" }).at(-1) as HTMLElement);
  });
  await waitFor(() =>
    expect(mockedRegister).toHaveBeenCalledWith(" 東区 ", "　ａｂｃｄ－１２３４　"),
  );
  await waitFor(() => expect(toast.success).toHaveBeenCalledWith("登録しました"));
  expect(screen.getByLabelText("配布先の名前")).toHaveValue("");
  expect(screen.getByLabelText("参加コード")).toHaveValue("");
});

test("登録に失敗したら理由を出し、入力は残す", async () => {
  mockedRegister.mockResolvedValue({
    ok: false,
    error: "同じ参加コードがすでに登録されています。",
  });
  render(<InviteCodeForm />);
  fill("東区", "abcd-1234");
  fireEvent.click(screen.getByRole("button", { name: "登録する" }));
  await screen.findByRole("dialog");
  await act(async () => {
    fireEvent.click(screen.getAllByRole("button", { name: "登録する" }).at(-1) as HTMLElement);
  });
  expect(await screen.findByRole("alert")).toHaveTextContent("すでに登録されています");
  expect(screen.getByLabelText("参加コード")).toHaveValue("abcd-1234");
});

test("コードの欄は password ではなく、補完を切っている", () => {
  render(<InviteCodeForm />);
  const input = screen.getByLabelText("参加コード");
  expect(input).not.toHaveAttribute("type", "password");
  expect(input).toHaveAttribute("autocomplete", "off");
  expect(input).toHaveAttribute("autocapitalize", "none");
  expect(input).toHaveAttribute("spellcheck", "false");
  expect(screen.getByLabelText("配布先の名前")).toHaveAttribute("maxlength", "50");
});

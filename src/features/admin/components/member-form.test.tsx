import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { addMemberAction } from "../actions";
import { MemberForm } from "./member-form";

jest.mock("../actions", () => ({ addMemberAction: jest.fn() }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
const mockedAdd = jest.mocked(addMemberAction);

beforeEach(() => {
  mockedAdd.mockReset();
  jest.mocked(toast.success).mockReset();
});

function fill(email: string) {
  fireEvent.change(screen.getByLabelText("メールアドレス"), { target: { value: email } });
}

async function confirm() {
  await act(async () => {
    fireEvent.click(screen.getAllByRole("button", { name: "登録する" }).at(-1) as HTMLElement);
  });
}

test("役割は運営が選ばれている", () => {
  render(<MemberForm />);
  expect(screen.getByRole("radio", { name: /^運営/ })).toBeChecked();
  expect(screen.getByRole("radio", { name: /^管理者/ })).not.toBeChecked();
});

test("メールの形でなければ、ダイアログの前に文言を出す", () => {
  render(<MemberForm />);
  fill("not-an-email");
  fireEvent.click(screen.getByRole("button", { name: "登録する" }));
  expect(screen.getByRole("alert")).toHaveTextContent("メールアドレスの形になっていません");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(mockedAdd).not.toHaveBeenCalled();
});

test("確認ではそろえたメールと役割を見せ、送る値は入力のまま（大文字もそのまま）", async () => {
  mockedAdd.mockResolvedValue({ ok: true, data: null });
  render(<MemberForm />);
  // type="email" の欄は、前後の空白をブラウザが落とす
  fill("New@Example.invalid");
  fireEvent.click(screen.getByRole("radio", { name: /^管理者/ }));
  fireEvent.click(screen.getByRole("button", { name: "登録する" }));
  const dialog = await screen.findByRole("dialog", { name: "この人を管理メンバーに登録しますか" });
  expect(dialog).toHaveTextContent("new@example.invalid");
  expect(dialog).toHaveTextContent("役割: 管理者");
  await confirm();
  await waitFor(() => expect(mockedAdd).toHaveBeenCalledWith("New@Example.invalid", "admin"));
  await waitFor(() => expect(toast.success).toHaveBeenCalledWith("登録しました"));
  expect(screen.getByLabelText("メールアドレス")).toHaveValue("");
  expect(screen.getByRole("radio", { name: /^運営/ })).toBeChecked();
});

test("登録に失敗したら理由を出し、入力は残す", async () => {
  mockedAdd.mockResolvedValue({ ok: false, error: "このメールアドレスはもう登録されています。" });
  render(<MemberForm />);
  fill("dup@example.invalid");
  fireEvent.click(screen.getByRole("button", { name: "登録する" }));
  await screen.findByRole("dialog");
  await confirm();
  expect(await screen.findByRole("alert")).toHaveTextContent("もう登録されています");
  expect(screen.getByLabelText("メールアドレス")).toHaveValue("dup@example.invalid");
  expect(toast.success).not.toHaveBeenCalled();
});

test("通信に失敗したら共通の文言", async () => {
  mockedAdd.mockRejectedValue(new Error("network"));
  render(<MemberForm />);
  fill("a@example.invalid");
  fireEvent.click(screen.getByRole("button", { name: "登録する" }));
  await screen.findByRole("dialog");
  await confirm();
  expect(await screen.findByRole("alert")).toBeInTheDocument();
});

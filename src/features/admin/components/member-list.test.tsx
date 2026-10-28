import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { toast } from "sonner";
import { removeMemberAction } from "../actions";
import type { MemberRow } from "../types";
import { MemberList } from "./member-list";

jest.mock("../actions", () => ({ removeMemberAction: jest.fn() }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
const mockedRemove = jest.mocked(removeMemberAction);

const rows: MemberRow[] = [
  {
    email: "me@example.invalid",
    role: "admin",
    created_at: "2026-10-01T01:00:00Z",
    last_sign_in_at: "2026-10-28T01:00:00Z",
    is_self: true,
  },
  {
    email: "staff@example.invalid",
    role: "operator",
    created_at: "2026-10-02T01:00:00Z",
    last_sign_in_at: null,
    is_self: false,
  },
];

beforeEach(() => {
  mockedRemove.mockReset();
  jest.mocked(toast.success).mockReset();
});

function rowOf(email: string): HTMLElement {
  return screen.getByText(email).closest("tr") as HTMLElement;
}

test("人数・役割・まだログインしていない人・自分の印を出す", () => {
  render(<MemberList rows={rows} />);
  expect(screen.getByText(/いま 2人です/)).toBeInTheDocument();
  const me = rowOf("me@example.invalid");
  expect(me).toHaveTextContent("あなた");
  expect(me).toHaveTextContent("管理者");
  const staff = rowOf("staff@example.invalid");
  expect(staff).toHaveTextContent("運営");
  expect(staff).toHaveTextContent("まだログインしていません");
  expect(staff).not.toHaveTextContent("あなた");
});

test("自分の行には「外す」を出さない", () => {
  render(<MemberList rows={rows} />);
  expect(within(rowOf("me@example.invalid")).queryByRole("button")).not.toBeInTheDocument();
  expect(
    within(rowOf("staff@example.invalid")).getByRole("button", {
      name: "staff@example.invalid を外す",
    }),
  ).toBeVisible();
});

test("外すは確かめてから送る", async () => {
  mockedRemove.mockResolvedValue({ ok: true, data: null });
  render(<MemberList rows={rows} />);
  fireEvent.click(
    within(rowOf("staff@example.invalid")).getByRole("button", {
      name: "staff@example.invalid を外す",
    }),
  );
  const dialog = await screen.findByRole("dialog", { name: "この人を管理メンバーから外しますか" });
  expect(dialog).toHaveTextContent("staff@example.invalid");
  expect(mockedRemove).not.toHaveBeenCalled();
  await act(async () => {
    fireEvent.click(within(dialog).getByRole("button", { name: "外す" }));
  });
  await waitFor(() => expect(mockedRemove).toHaveBeenCalledWith("staff@example.invalid"));
  await waitFor(() => expect(toast.success).toHaveBeenCalledWith("外しました"));
});

test("外すのに失敗したら理由を出す", async () => {
  mockedRemove.mockResolvedValue({
    ok: false,
    error: "この人はもう外されています。画面を更新してください。",
  });
  render(<MemberList rows={rows} />);
  fireEvent.click(
    within(rowOf("staff@example.invalid")).getByRole("button", {
      name: "staff@example.invalid を外す",
    }),
  );
  const dialog = await screen.findByRole("dialog");
  await act(async () => {
    fireEvent.click(within(dialog).getByRole("button", { name: "外す" }));
  });
  expect(await screen.findByRole("alert")).toHaveTextContent("もう外されています");
  expect(toast.success).not.toHaveBeenCalled();
});

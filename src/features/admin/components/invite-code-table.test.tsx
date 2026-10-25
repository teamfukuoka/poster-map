import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { revealInviteCodeAction, revokeInviteCodeAction } from "../actions";
import type { InviteCodeRow } from "../types";
import { InviteCodeTable } from "./invite-code-table";

jest.mock("../actions", () => ({
  revealInviteCodeAction: jest.fn(),
  revokeInviteCodeAction: jest.fn(),
}));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
const mockedReveal = jest.mocked(revealInviteCodeAction);
const mockedRevoke = jest.mocked(revokeInviteCodeAction);

const rows: InviteCodeRow[] = [
  {
    id: "c1",
    label: "東区リーダー配布",
    created_at: "2026-10-25T01:00:00Z",
    revoked_at: null,
    volunteers: 5,
    active_volunteers: 3,
    has_code: true,
  },
  {
    id: "c2",
    label: "以前のコード",
    created_at: "2026-10-01T01:00:00Z",
    revoked_at: null,
    volunteers: 0,
    active_volunteers: 0,
    has_code: false,
  },
  {
    id: "c3",
    label: "止めたコード",
    created_at: "2026-10-02T01:00:00Z",
    revoked_at: "2026-10-03T01:00:00Z",
    volunteers: 1,
    active_volunteers: 0,
    has_code: true,
  },
];

beforeEach(() => {
  mockedReveal.mockReset();
  mockedRevoke.mockReset();
  jest.mocked(toast.success).mockReset();
});

test("名前・人数・状態を出し、コードは「表示」を押すまで出さない", () => {
  const { container } = render(<InviteCodeTable rows={rows} isAdmin />);
  const html = container.innerHTML;
  expect(html).toContain("東区リーダー配布");
  expect(html).toContain("5人（うち止めていない 3人）");
  expect(html).toContain("有効");
  expect(html).toContain("失効");
  expect(html).toContain("コードを表示すると、操作の記録に残ります。");
  expect(html).toContain("以前の方法で登録したため表示できません");
  expect(html).not.toContain("<code");
  // has_code が true の行（c1, c3）にだけ「表示」
  expect(html.match(/表示<\/button>/g)).toHaveLength(2);
});

test("「表示」を押すとコードを取って等幅で出し、コピーできる", async () => {
  mockedReveal.mockResolvedValue({ ok: true, data: { code: "abcd-1234" } });
  const writeText = jest.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  render(<InviteCodeTable rows={rows} isAdmin={false} />);
  fireEvent.click(screen.getAllByRole("button", { name: "表示" })[0]);
  const code = await screen.findByText("abcd-1234");
  expect(code.tagName).toBe("CODE");
  expect(mockedReveal).toHaveBeenCalledWith("c1");
  fireEvent.click(screen.getByRole("button", { name: /コピー/ }));
  await waitFor(() => expect(writeText).toHaveBeenCalledWith("abcd-1234"));
});

test("表示に失敗したら、その行に理由を出す", async () => {
  mockedReveal.mockResolvedValue({ ok: false, error: "この操作は管理者だけができます。" });
  render(<InviteCodeTable rows={rows} isAdmin={false} />);
  fireEvent.click(screen.getAllByRole("button", { name: "表示" })[0]);
  expect(await screen.findByRole("alert")).toHaveTextContent("管理者だけ");
});

test("運営には「失効させる」を描かない", () => {
  render(<InviteCodeTable rows={rows} isAdmin={false} />);
  expect(screen.queryByText("失効させる")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /失効/ })).not.toBeInTheDocument();
});

test("管理者には有効な行にだけ「失効させる」を出す", () => {
  render(<InviteCodeTable rows={rows} isAdmin />);
  expect(screen.getAllByRole("button", { name: "失効させる" })).toHaveLength(2);
});

test("失効：チェックなしなら人は止めず、止めた人数を出す", async () => {
  mockedRevoke.mockResolvedValue({ ok: true, data: { revokedVolunteers: 0 } });
  render(<InviteCodeTable rows={rows} isAdmin />);
  fireEvent.click(screen.getAllByRole("button", { name: "失効させる" })[0]);
  expect(
    screen.getByText("コードが外にもれたときはチェックをつけてください。"),
  ).toBeInTheDocument();
  await act(async () => {
    fireEvent.click(screen.getAllByRole("button", { name: "失効させる" }).at(-1) as HTMLElement);
  });
  await waitFor(() => expect(mockedRevoke).toHaveBeenCalledWith("c1", false));
  await waitFor(() =>
    expect(toast.success).toHaveBeenCalledWith("失効させました（止めた人数: 0）"),
  );
});

test("失効：チェックをつけると、参加した人もまとめて止める", async () => {
  mockedRevoke.mockResolvedValue({ ok: true, data: { revokedVolunteers: 3 } });
  render(<InviteCodeTable rows={rows} isAdmin />);
  fireEvent.click(screen.getAllByRole("button", { name: "失効させる" })[0]);
  fireEvent.click(screen.getByRole("checkbox", { name: "このコードで参加した人もまとめて止める" }));
  await act(async () => {
    fireEvent.click(screen.getAllByRole("button", { name: "失効させる" }).at(-1) as HTMLElement);
  });
  await waitFor(() => expect(mockedRevoke).toHaveBeenCalledWith("c1", true));
  await waitFor(() =>
    expect(toast.success).toHaveBeenCalledWith("失効させました（止めた人数: 3）"),
  );
});

test("失効に失敗したら理由を出す", async () => {
  mockedRevoke.mockResolvedValue({
    ok: false,
    error: "参加コードが見つからないか、すでに失効しています。",
  });
  render(<InviteCodeTable rows={rows} isAdmin />);
  fireEvent.click(screen.getAllByRole("button", { name: "失効させる" })[0]);
  await act(async () => {
    fireEvent.click(screen.getAllByRole("button", { name: "失効させる" }).at(-1) as HTMLElement);
  });
  expect(await screen.findByRole("alert")).toHaveTextContent("すでに失効しています");
});

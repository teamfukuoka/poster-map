import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { joinAction } from "../actions";
import { JoinDialog } from "./join-dialog";

jest.mock("../actions", () => ({ joinAction: jest.fn() }));
const mockedJoin = jest.mocked(joinAction);

function fill(code: string, name: string) {
  fireEvent.change(screen.getByLabelText("参加コード"), { target: { value: code } });
  fireEvent.change(screen.getByLabelText("ニックネーム"), { target: { value: name } });
  fireEvent.click(screen.getByRole("button", { name: "参加する" }));
}

beforeEach(() => mockedJoin.mockReset());

test("参加できたら onJoined にニックネームを渡す", async () => {
  mockedJoin.mockResolvedValue({ ok: true, data: { displayName: "はなこ" } });
  const onJoined = jest.fn();
  render(<JoinDialog open onOpenChange={jest.fn()} onJoined={onJoined} />);
  fill("code-1", "はなこ");
  await waitFor(() => expect(onJoined).toHaveBeenCalledWith("はなこ"));
  expect(mockedJoin).toHaveBeenCalledWith("code-1", "はなこ");
});

test("失敗したら理由を出し、閉じない", async () => {
  mockedJoin.mockResolvedValue({ ok: false, error: "参加コードが正しくありません。" });
  const onJoined = jest.fn();
  render(<JoinDialog open onOpenChange={jest.fn()} onJoined={onJoined} />);
  fill("wrong", "はなこ");
  expect(await screen.findByRole("alert")).toHaveTextContent("参加コードが正しくありません。");
  expect(onJoined).not.toHaveBeenCalled();
});

test("集める情報と、プライバシーのページを案内する", () => {
  render(<JoinDialog open onOpenChange={jest.fn()} onJoined={jest.fn()} />);
  expect(screen.getByText(/登録するのはニックネームだけです/)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "プライバシーについて" })).toHaveAttribute(
    "href",
    "/privacy",
  );
});

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { joinAction } from "../actions";
import { FALLBACK_MESSAGE } from "../errors";
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

test("使い方ガイドを別のタブで開ける", () => {
  render(<JoinDialog open onOpenChange={jest.fn()} onJoined={jest.fn()} />);
  const link = screen.getByRole("link", { name: "使い方ガイド" });
  expect(link).toHaveAttribute("href", "/guide");
  expect(link).toHaveAttribute("target", "_blank");
});

test("参加が reject されても、確認中のままにせず汎用の文言を出す", async () => {
  mockedJoin.mockRejectedValue(new Error("network"));
  const onJoined = jest.fn();
  render(<JoinDialog open onOpenChange={jest.fn()} onJoined={onJoined} />);
  fill("code-1", "はなこ");
  expect(await screen.findByRole("alert")).toHaveTextContent(FALLBACK_MESSAGE);
  expect(screen.getByRole("button", { name: "参加する" })).toBeEnabled();
  expect(onJoined).not.toHaveBeenCalled();
});

test("右上の閉じるボタンに日本語の名前がある", () => {
  render(<JoinDialog open onOpenChange={jest.fn()} onJoined={jest.fn()} />);
  expect(screen.getByRole("button", { name: "閉じる" })).toBeInTheDocument();
});

import { act, fireEvent, render, screen } from "@testing-library/react";
import { toast } from "sonner";
import { setStickerEnabledAction } from "../actions";
import { StickerControls } from "./sticker-controls";

jest.mock("../actions", () => ({ setStickerEnabledAction: jest.fn() }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

beforeEach(() => {
  jest.mocked(setStickerEnabledAction).mockReset().mockResolvedValue({ ok: true, data: null });
  jest.mocked(toast.success).mockReset();
});

const click = async (name: string) => {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name }));
  });
};

test("止めているときは「始める」を出し、確かめてから ON にする", async () => {
  render(<StickerControls enabled={false} canChange />);
  expect(screen.getByText("止めている")).toBeInTheDocument();
  await click("シールの報告を始める");
  expect(screen.getByText(/最初はシールの表示で開きます/)).toBeInTheDocument();
  expect(setStickerEnabledAction).not.toHaveBeenCalled();
  await click("始める");
  expect(setStickerEnabledAction).toHaveBeenCalledWith(true);
  expect(toast.success).toHaveBeenCalledWith("シールの報告を始めました");
});

test("受け付け中のときは「止める」を出し、報告が消えないことを伝える", async () => {
  render(<StickerControls enabled canChange />);
  expect(screen.getByText("受け付け中")).toBeInTheDocument();
  await click("シールの報告を止める");
  expect(screen.getByText(/これまでの報告は消えません/)).toBeInTheDocument();
  await click("止める");
  expect(setStickerEnabledAction).toHaveBeenCalledWith(false);
});

test("失敗したら理由を出す", async () => {
  jest
    .mocked(setStickerEnabledAction)
    .mockResolvedValue({ ok: false, error: "この操作は管理者だけができます。" });
  render(<StickerControls enabled={false} canChange />);
  await click("シールの報告を始める");
  await click("始める");
  expect(screen.getByRole("alert")).toHaveTextContent("この操作は管理者だけができます。");
  expect(toast.success).not.toHaveBeenCalled();
});

test("運営には状態だけを出し、ボタンは出さない", () => {
  render(<StickerControls enabled canChange={false} />);
  expect(screen.getByText("受け付け中")).toBeInTheDocument();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  expect(screen.getByText("切り替えは管理者だけができます。")).toBeInTheDocument();
});

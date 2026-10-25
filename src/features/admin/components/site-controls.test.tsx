import { act, fireEvent, render, screen } from "@testing-library/react";
import { publishSiteAction, revertAcceptanceAction, setForceHiddenAction } from "../actions";
import type { SiteState } from "../types";
import { SiteControls, SiteStatus } from "./site-controls";

jest.mock("../actions", () => ({
  publishSiteAction: jest.fn(),
  revertAcceptanceAction: jest.fn(),
  setForceHiddenAction: jest.fn(),
}));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const site: SiteState = {
  public_from: "2026-10-31T15:00:00Z",
  public_until: "2026-11-15T15:00:00Z",
  force_hidden: false,
  is_public: false,
  rehearsal_reset_until: "2026-10-31T15:00:00Z",
  accepted_at: null,
  site_name: "福岡市ポスター掲示板マップ",
};
const accepted: SiteState = { ...site, accepted_at: "2026-11-01T01:00:00Z", is_public: true };

beforeEach(() => {
  jest.mocked(publishSiteAction).mockReset().mockResolvedValue({ ok: true, data: null });
  jest.mocked(revertAcceptanceAction).mockReset().mockResolvedValue({ ok: true, data: null });
  jest.mocked(setForceHiddenAction).mockReset().mockResolvedValue({ ok: true, data: null });
});

const click = async (name: string) => {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name }));
  });
};

test("状態に、サイト名と受理の確認を出す", () => {
  const { rerender } = render(<SiteStatus site={site} />);
  expect(screen.getByText("福岡市ポスター掲示板マップ")).toBeInTheDocument();
  expect(screen.getByText("まだ")).toBeInTheDocument();
  rerender(<SiteStatus site={accepted} />);
  expect(screen.getByText(/^済み（/)).toBeInTheDocument();
});

test("受理前: 「公開する」と「止める」が出て、「公開を再開する」は出ない", () => {
  render(<SiteControls site={site} beforePublicFrom={false} />);
  expect(screen.getByRole("button", { name: "公開する" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "一般の人への公開を止める" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "公開を再開する" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "受理前に戻す" })).not.toBeInTheDocument();
});

test("受理前で止めているときは「止める」を出さない", () => {
  render(<SiteControls site={{ ...site, force_hidden: true }} beforePublicFrom={false} />);
  expect(
    screen.queryByRole("button", { name: "一般の人への公開を止める" }),
  ).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "公開を再開する" })).not.toBeInTheDocument();
});

test("公開期間の始まりより前は「公開する」を押せず、理由を出す", () => {
  render(<SiteControls site={site} beforePublicFrom />);
  expect(screen.getByRole("button", { name: "公開する" })).toBeDisabled();
  expect(screen.getByText("11月1日0:00から押せます。")).toBeInTheDocument();
});

test("「公開する」は確認の文字を入れるまで実行できず、入れると publishSiteAction を呼ぶ", async () => {
  render(<SiteControls site={site} beforePublicFrom={false} />);
  await click("公開する");
  expect(screen.getByRole("dialog", { name: "公開しますか" })).toBeInTheDocument();
  const run = screen.getAllByRole("button", { name: "公開する" }).at(-1) as HTMLElement;
  expect(run).toBeDisabled();
  fireEvent.change(screen.getByLabelText(/「公開する」と入力/), { target: { value: "公開する" } });
  await act(async () => {
    fireEvent.click(run);
  });
  expect(publishSiteAction).toHaveBeenCalledWith("公開する");
});

test("サーバーのエラー（not_accepted など）は画面に出す", async () => {
  jest.mocked(publishSiteAction).mockResolvedValue({ ok: false, error: "受理を確かめる前です" });
  render(<SiteControls site={site} beforePublicFrom={false} />);
  await click("公開する");
  fireEvent.change(screen.getByLabelText(/「公開する」と入力/), { target: { value: "公開する" } });
  await act(async () => {
    fireEvent.click(screen.getAllByRole("button", { name: "公開する" }).at(-1) as HTMLElement);
  });
  expect(screen.getByRole("alert")).toHaveTextContent("受理を確かめる前です");
});

test("action が例外を投げても、画面にエラーを出す", async () => {
  jest.mocked(setForceHiddenAction).mockRejectedValue(new Error("network"));
  render(<SiteControls site={accepted} beforePublicFrom={false} />);
  await click("一般の人への公開を止める");
  await click("止める");
  expect(screen.getByRole("alert")).toBeInTheDocument();
});

test("受理後: 止める／再開する と、小さな「受理前に戻す」", async () => {
  const { rerender } = render(<SiteControls site={accepted} beforePublicFrom={false} />);
  expect(screen.queryByRole("button", { name: "公開する" })).not.toBeInTheDocument();
  await click("一般の人への公開を止める");
  expect(
    screen.getByText("止めても、参加済みのボランティアはそのまま使えます。"),
  ).toBeInTheDocument();
  await click("止める");
  expect(setForceHiddenAction).toHaveBeenCalledWith(true);

  rerender(<SiteControls site={{ ...accepted, force_hidden: true }} beforePublicFrom={false} />);
  await click("公開を再開する");
  await click("再開する");
  expect(setForceHiddenAction).toHaveBeenCalledWith(false);
  expect(screen.getByRole("button", { name: "受理前に戻す" })).toBeInTheDocument();
});

test("「受理前に戻す」は確認の文字が要り、revertAcceptanceAction を呼ぶ", async () => {
  render(<SiteControls site={accepted} beforePublicFrom={false} />);
  await click("受理前に戻す");
  expect(screen.getByRole("dialog", { name: "受理前に戻しますか" })).toBeInTheDocument();
  const run = screen.getAllByRole("button", { name: "受理前に戻す" }).at(-1) as HTMLElement;
  expect(run).toBeDisabled();
  fireEvent.change(screen.getByLabelText(/「受理前に戻す」と入力/), {
    target: { value: "受理前に戻す" },
  });
  await act(async () => {
    fireEvent.click(run);
  });
  expect(revertAcceptanceAction).toHaveBeenCalledWith("受理前に戻す");
});

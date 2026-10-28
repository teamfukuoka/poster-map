import { render, screen, within } from "@testing-library/react";
import { HELP_SECTIONS, helpHref } from "../help-sections";
import {
  INVITE_CODE_MIN_LENGTH,
  PUBLISH_CONFIRM_WORD,
  RESET_CONFIRM_WORD,
  REVERT_CONFIRM_WORD,
} from "../validation";
import { AdminHelpContent } from "./admin-help-content";
import { HelpLink } from "./help-link";

const ALL_IDS = HELP_SECTIONS.flatMap((s) => [
  s.id,
  ...("topics" in s ? s.topics.map((t) => t.id) : []),
]);

function sectionOf(id: string): HTMLElement {
  return document.getElementById(id) as HTMLElement;
}

test("目次のすべての節と小見出しに、飛び先の見出しがある", () => {
  const { container } = render(<AdminHelpContent />);
  for (const id of ALL_IDS) {
    const target = container.querySelector(`#${id}`);
    expect(target).not.toBeNull();
    expect(target?.querySelector("h2, h3")).not.toBeNull();
  }
});

test("ページ内のリンクは、どれもページの中の見出しに飛ぶ", () => {
  const { container } = render(<AdminHelpContent />);
  const anchors = [...container.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')];
  expect(anchors.length).toBeGreaterThan(ALL_IDS.length);
  for (const a of anchors) {
    const id = a.getAttribute("href")?.slice(1) ?? "";
    expect(container.querySelector(`#${id}`)).not.toBeNull();
  }
});

test("各画面の節から、その画面を開ける", () => {
  render(<AdminHelpContent />);
  expect(within(sectionOf("codes")).getByRole("link", { name: "この画面を開く" })).toHaveAttribute(
    "href",
    "/admin/codes",
  );
  expect(
    within(sectionOf("coverage")).getAllByRole("link", { name: "この画面を開く" })[0],
  ).toHaveAttribute("href", "/admin/coverage");
});

test("確認の文字とコードの決まりは、アプリの定義どおりに出す", () => {
  render(<AdminHelpContent />);
  expect(
    within(sectionOf("site-publish")).getByText(
      new RegExp(`「${PUBLISH_CONFIRM_WORD}」と入れます`),
    ),
  ).toBeInTheDocument();
  expect(
    within(sectionOf("site-publish")).getByText(new RegExp(`「${REVERT_CONFIRM_WORD}」と入れます`)),
  ).toBeInTheDocument();
  expect(
    within(sectionOf("site-reset")).getByText(new RegExp(`「${RESET_CONFIRM_WORD}」と入れます`)),
  ).toBeInTheDocument();
  expect(
    within(sectionOf("codes-register")).getByText(new RegExp(`${INVITE_CODE_MIN_LENGTH}〜`)),
  ).toBeInTheDocument();
});

test("管理者だけの操作に印をつける", () => {
  render(<AdminHelpContent />);
  for (const id of ["codes-register", "site-publish", "site-reset"]) {
    expect(within(sectionOf(id)).getAllByText("管理者だけ").length).toBeGreaterThan(0);
  }
  expect(within(sectionOf("coverage-register")).queryByText("管理者だけ")).not.toBeInTheDocument();
});

test("「くわしく」は、ヘルプの該当する節に飛び、何の説明かを読み上げる", () => {
  render(<HelpLink id="coverage-register" />);
  const link = screen.getByRole("link", { name: "担当者を登録するのくわしい説明" });
  expect(link).toHaveAttribute("href", helpHref("coverage-register"));
  expect(link).toHaveAttribute("href", "/admin/help#coverage-register");
  expect(link).toHaveTextContent("くわしく");
});

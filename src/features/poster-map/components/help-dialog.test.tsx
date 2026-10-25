import { render, screen } from "@testing-library/react";
import { HelpDialog } from "./help-dialog";

test("くわしい使い方ガイドへのリンクがある", () => {
  render(<HelpDialog open onOpenChange={jest.fn()} isVolunteer={false} />);
  expect(screen.getByRole("link", { name: "くわしい使い方ガイド" })).toHaveAttribute(
    "href",
    "/guide",
  );
});

test("参加中の人には、予約がほかの人へのお知らせで、すぐ貼れるなら完了だけでよいと伝える", () => {
  render(<HelpDialog open onOpenChange={jest.fn()} isVolunteer />);
  expect(screen.getByText(/「ここには私が行きます」と知らせる/)).toBeInTheDocument();
  expect(screen.getByText(/その場ですぐ貼れるときは/)).toBeInTheDocument();
  expect(screen.getByText(/予約は時間がたっても消えません/)).toBeInTheDocument();
});

test("色の意味は、一般の人には他候補を「要確認」と出す", () => {
  render(<HelpDialog open onOpenChange={jest.fn()} isVolunteer={false} />);
  expect(screen.getByText("要確認")).toBeInTheDocument();
  expect(screen.queryByText(/他候補/)).not.toBeInTheDocument();
});

test("色の意味は、参加中の人には「他候補」と出す", () => {
  render(<HelpDialog open onOpenChange={jest.fn()} isVolunteer />);
  expect(screen.getByText("他候補")).toBeInTheDocument();
});

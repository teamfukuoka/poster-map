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

import { render, screen } from "@testing-library/react";
import { HelpDialog } from "./help-dialog";

test("くわしい使い方ガイドへのリンクがある", () => {
  render(<HelpDialog open onOpenChange={jest.fn()} isVolunteer={false} />);
  expect(screen.getByRole("link", { name: "くわしい使い方ガイド" })).toHaveAttribute(
    "href",
    "/guide",
  );
});

import { act, fireEvent, render, screen } from "@testing-library/react";
import { LogoutButton } from "./logout-button";

jest.mock("../auth-actions", () => ({ logoutAction: jest.fn() }));

const requestSubmit = jest.fn();

beforeEach(() => {
  requestSubmit.mockClear();
  HTMLFormElement.prototype.requestSubmit = requestSubmit;
});

test("押すとすぐにはログアウトせず、確かめる", () => {
  render(<LogoutButton />);
  fireEvent.click(screen.getByRole("button", { name: "ログアウト" }));
  expect(screen.getByRole("dialog", { name: "ログアウトしますか？" })).toBeInTheDocument();
  expect(requestSubmit).not.toHaveBeenCalled();
});

test("やめるでは送らずに閉じる", () => {
  render(<LogoutButton />);
  fireEvent.click(screen.getByRole("button", { name: "ログアウト" }));
  fireEvent.click(screen.getByRole("button", { name: "やめる" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(requestSubmit).not.toHaveBeenCalled();
});

test("ログアウトするで送る", async () => {
  render(<LogoutButton />);
  fireEvent.click(screen.getByRole("button", { name: "ログアウト" }));
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "ログアウトする" }));
  });
  expect(requestSubmit).toHaveBeenCalledTimes(1);
});

import { act, fireEvent, render, screen } from "@testing-library/react";
import { ConfirmDialog } from "./confirm-dialog";

function setup(props: Partial<React.ComponentProps<typeof ConfirmDialog>> = {}) {
  const onOpenChange = jest.fn();
  const onConfirm = jest.fn().mockResolvedValue(undefined);
  render(
    <ConfirmDialog
      open
      onOpenChange={onOpenChange}
      title="確かめます"
      description={<p>本文</p>}
      confirmLabel="実行する"
      onConfirm={onConfirm}
      {...props}
    />,
  );
  return { onOpenChange, onConfirm };
}

test("題名と本文を出し、押すと実行して閉じる", async () => {
  const { onOpenChange, onConfirm } = setup();
  expect(screen.getByRole("dialog", { name: "確かめます" })).toBeInTheDocument();
  expect(screen.getByText("本文")).toBeInTheDocument();
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "実行する" }));
  });
  expect(onOpenChange).toHaveBeenCalledWith(false);
  expect(onConfirm).toHaveBeenCalledTimes(1);
});

test("やめるでは実行しない", () => {
  const { onOpenChange, onConfirm } = setup();
  fireEvent.click(screen.getByRole("button", { name: "やめる" }));
  expect(onOpenChange).toHaveBeenCalledWith(false);
  expect(onConfirm).not.toHaveBeenCalled();
});

test("confirmWord があると、一致するまで実行できない", async () => {
  const { onConfirm } = setup({ confirmWord: "リセット" });
  const run = screen.getByRole("button", { name: "実行する" });
  expect(run).toBeDisabled();
  fireEvent.change(screen.getByLabelText(/「リセット」と入力/), { target: { value: "リセ" } });
  expect(run).toBeDisabled();
  fireEvent.change(screen.getByLabelText(/「リセット」と入力/), { target: { value: "リセット" } });
  expect(run).toBeEnabled();
  await act(async () => {
    fireEvent.click(run);
  });
  expect(onConfirm).toHaveBeenCalledTimes(1);
});

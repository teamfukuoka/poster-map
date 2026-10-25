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

test("実行中は、やめる・Escape・外側のクリックで閉じない", async () => {
  let finish: () => void = () => {};
  const onConfirm = jest.fn(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const { onOpenChange } = setup({ onConfirm });
  fireEvent.click(screen.getByRole("button", { name: "実行する" }));
  expect(screen.getByRole("button", { name: "実行する" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "やめる" })).toBeDisabled();

  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  fireEvent.pointerDown(document.body);
  fireEvent.click(document.body);
  expect(onOpenChange).not.toHaveBeenCalledWith(false);

  await act(async () => {
    finish();
  });
  expect(onOpenChange).toHaveBeenCalledWith(false);
});

test("実行していないときは Escape で閉じられる", () => {
  const { onOpenChange } = setup();
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  expect(onOpenChange).toHaveBeenCalledWith(false);
});

test("onConfirm が失敗しても、未処理の rejection にせず、console.error に出して閉じる", async () => {
  const error = new Error("失敗");
  const spy = jest.spyOn(console, "error").mockImplementation(() => {});
  const unhandled = jest.fn();
  process.on("unhandledRejection", unhandled);
  const { onOpenChange } = setup({ onConfirm: jest.fn().mockRejectedValue(error) });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "実行する" }));
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  process.off("unhandledRejection", unhandled);
  expect(unhandled).not.toHaveBeenCalled();
  expect(spy).toHaveBeenCalledWith(error);
  expect(onOpenChange).toHaveBeenCalledWith(false);
  spy.mockRestore();
});

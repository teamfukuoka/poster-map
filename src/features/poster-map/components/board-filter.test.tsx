import { fireEvent, render, screen } from "@testing-library/react";
import { BOARD_STATUSES } from "../status";
import { BoardFilter } from "./board-filter";

function setup(overrides: Partial<Parameters<typeof BoardFilter>[0]> = {}) {
  const props = {
    filterState: { statuses: new Set(BOARD_STATUSES), showOnlyMine: false },
    isVolunteer: true,
    onToggleStatus: jest.fn(),
    onToggleShowOnlyMine: jest.fn(),
    onSelectAll: jest.fn(),
    onDeselectAll: jest.fn(),
    ...overrides,
  };
  render(<BoardFilter {...props} />);
  fireEvent.click(screen.getByRole("button", { name: /フィルター/ }));
  return props;
}

test("開くと全ステータスのチェックボックスが並ぶ", () => {
  setup();
  expect(screen.getAllByRole("checkbox")).toHaveLength(BOARD_STATUSES.length + 1);
  expect(screen.getByRole("checkbox", { name: "他候補" })).toBeChecked();
});

test("一般の人には他候補を「要確認」と出す", () => {
  setup({ isVolunteer: false });
  expect(screen.getByRole("checkbox", { name: "要確認" })).toBeChecked();
  expect(screen.queryByText(/他候補/)).not.toBeInTheDocument();
});

test("チェックを外すと onToggleStatus を呼ぶ", () => {
  const props = setup();
  fireEvent.click(screen.getByRole("checkbox", { name: "完了" }));
  expect(props.onToggleStatus).toHaveBeenCalledWith("done");
});

test("参加していない人には「自分が更新したもの」を出さない", () => {
  setup({ isVolunteer: false });
  expect(
    screen.queryByRole("checkbox", { name: "自分が更新したものだけ" }),
  ).not.toBeInTheDocument();
});

test("絞り込み中は件数を出す", () => {
  render(
    <BoardFilter
      filterState={{ statuses: new Set(["done"]), showOnlyMine: false }}
      isVolunteer
      onToggleStatus={jest.fn()}
      onToggleShowOnlyMine={jest.fn()}
      onSelectAll={jest.fn()}
      onDeselectAll={jest.fn()}
    />,
  );
  expect(screen.getByRole("button", { name: "フィルター （1）" })).toBeInTheDocument();
});

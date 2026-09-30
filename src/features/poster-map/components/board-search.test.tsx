import { fireEvent, render, screen } from "@testing-library/react";
import type { MapBoard } from "../types";
import { BoardSearch } from "./board-search";

const boards: MapBoard[] = [
  {
    id: "1",
    number: "1-1",
    name: "天神公園",
    address: "中央区天神1丁目",
    ward: "中央区",
    lat: 33.59,
    long: 130.4,
    status: "not_yet",
  },
  {
    id: "2",
    number: "2-1",
    name: "博多駅前",
    address: "博多区博多駅前2丁目",
    ward: "博多区",
    lat: 33.59,
    long: 130.42,
    status: "done",
  },
];

function type(value: string) {
  fireEvent.change(screen.getByRole("textbox", { name: "掲示板を検索" }), {
    target: { value },
  });
}

test("2文字以上で候補を出し、選ぶと onSelect を呼んで閉じる", () => {
  const onSelect = jest.fn();
  render(<BoardSearch boards={boards} onSelect={onSelect} />);
  type("天神");
  fireEvent.click(screen.getByRole("button", { name: /天神公園/ }));
  expect(onSelect).toHaveBeenCalledWith(boards[0]);
  expect(screen.queryByRole("button", { name: /天神公園/ })).not.toBeInTheDocument();
});

test("1文字では候補を出さない", () => {
  render(<BoardSearch boards={boards} onSelect={jest.fn()} />);
  type("天");
  expect(screen.queryByRole("list")).not.toBeInTheDocument();
});

test("該当なしを知らせる", () => {
  render(<BoardSearch boards={boards} onSelect={jest.fn()} />);
  type("存在しない");
  expect(screen.getByText("該当する掲示板がありません")).toBeInTheDocument();
});

test("Esc で閉じる", () => {
  render(<BoardSearch boards={boards} onSelect={jest.fn()} />);
  type("博多");
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByRole("list")).not.toBeInTheDocument();
});

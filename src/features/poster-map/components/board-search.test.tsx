import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import type { MapBoard } from "../types";
import { BoardSearch } from "./board-search";

const boards: MapBoard[] = [
  {
    id: "1",
    number: "天神-1",
    name: "天神公園",
    address: "中央区天神1丁目",
    ward: "中央区",
    lat: 33.59,
    long: 130.4,
    status: "not_yet",
  },
  {
    id: "2",
    number: "博多-1",
    name: "博多駅前",
    address: "博多区博多駅前2丁目",
    ward: "博多区",
    lat: 33.59,
    long: 130.42,
    status: "done",
  },
  {
    id: "3",
    number: "天神-2",
    name: "警固神社横",
    address: "中央区天神2丁目",
    ward: "中央区",
    lat: 33.58,
    long: 130.4,
    status: "not_yet",
  },
];

function renderSearch(props: Partial<ComponentProps<typeof BoardSearch>> = {}) {
  const handlers = {
    onSelect: jest.fn(),
    onSelectDistrict: jest.fn(),
    onRemoveDistrict: jest.fn(),
    onClearDistricts: jest.fn(),
  };
  render(<BoardSearch boards={boards} districts={[]} {...handlers} {...props} />);
  return handlers;
}

function type(value: string) {
  fireEvent.change(screen.getByRole("searchbox", { name: "掲示板を探す" }), {
    target: { value },
  });
}

test("見出し「掲示板を探す」と、何で探せるかの例を出す", () => {
  renderSearch();
  const box = screen.getByRole("searchbox", { name: "掲示板を探す" });
  expect(box).toHaveAttribute("placeholder", "投票区・場所・住所で探す");
  expect(box).toHaveAccessibleDescription("例：馬出第一、香椎浜小学校、筥松");
});

test("全画面の帯（compact）では見出しと例を省くが、欄の名前は残す", () => {
  renderSearch({ compact: true });
  expect(screen.getByRole("searchbox", { name: "掲示板を探す" })).toBeInTheDocument();
  expect(screen.queryByText(/^例：/)).not.toBeInTheDocument();
});

test("2文字以上で候補を出し、場所の名前を大きく・投票区と番号と住所を小さく出す。選ぶと onSelect を呼んで閉じる", () => {
  const { onSelect } = renderSearch();
  type("天神公");
  const row = screen.getByRole("button", { name: /天神公園/ });
  expect(row).toHaveTextContent("天神公園天神 1番・中央区天神1丁目");
  fireEvent.click(row);
  expect(onSelect).toHaveBeenCalledWith(boards[0]);
  expect(screen.queryByRole("button", { name: /天神公園/ })).not.toBeInTheDocument();
});

test("投票区の名前を入れると、いちばん上に投票区の候補が出る。選ぶと onSelectDistrict を呼ぶ", () => {
  const { onSelectDistrict } = renderSearch();
  type("天神");
  const buttons = screen.getAllByRole("button");
  expect(buttons[1]).toHaveTextContent("天神（投票区・2か所）");
  fireEvent.click(buttons[1]);
  expect(onSelectDistrict).toHaveBeenCalledWith({ district: "天神", ward: "中央区", count: 2 });
  expect(screen.getByRole("searchbox", { name: "掲示板を探す" })).toHaveValue("");
});

test("表示中の投票区は候補に「表示中」と出す", () => {
  renderSearch({ districts: ["天神"] });
  type("天神");
  expect(screen.getAllByRole("button")[1]).toHaveTextContent("天神（投票区・2か所・表示中）");
});

test("投票区で絞っている間は選んだ投票区をチップで並べ、× で 1 つずつ外せる", () => {
  const { onRemoveDistrict } = renderSearch({ districts: ["天神", "博多"] });
  const group = screen.getByRole("group", { name: "表示中の投票区" });
  expect(group).toHaveTextContent("この投票区だけ表示中：天神博多全部表示に戻す");
  fireEvent.click(screen.getByRole("button", { name: "博多を表示から外す" }));
  expect(onRemoveDistrict).toHaveBeenCalledWith("博多");
});

test("2つ以上選んでいるときは「全部表示に戻す」で全部に戻せる", () => {
  const { onClearDistricts } = renderSearch({ districts: ["天神", "博多"] });
  fireEvent.click(screen.getByRole("button", { name: "全部表示に戻す" }));
  expect(onClearDistricts).toHaveBeenCalled();
});

test("1つだけなら「全部表示に戻す」は出さず、× で戻す", () => {
  renderSearch({ districts: ["天神"] });
  expect(screen.getByRole("button", { name: "天神を表示から外す" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "全部表示に戻す" })).not.toBeInTheDocument();
});

test("絞っていないときはチップを出さない", () => {
  renderSearch();
  expect(screen.queryByRole("group", { name: "表示中の投票区" })).not.toBeInTheDocument();
});

test("1文字では候補を出さない", () => {
  renderSearch();
  type("天");
  expect(screen.queryByRole("list")).not.toBeInTheDocument();
});

test("該当なしを知らせる", () => {
  renderSearch();
  type("存在しない");
  expect(screen.getByText("該当する掲示板がありません")).toBeInTheDocument();
});

test("Esc で閉じる", () => {
  renderSearch();
  type("博多");
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByRole("list")).not.toBeInTheDocument();
});

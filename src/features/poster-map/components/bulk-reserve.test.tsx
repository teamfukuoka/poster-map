import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { toast } from "sonner";
import { releaseMyReservationsAction, reserveBoardsAction } from "../actions";
import { FALLBACK_MESSAGE } from "../errors";
import type { MapBoard } from "../types";
import { BulkReserve } from "./bulk-reserve";

jest.mock("../actions", () => ({
  releaseMyReservationsAction: jest.fn(),
  reserveBoardsAction: jest.fn(),
}));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
const mockedReserve = jest.mocked(reserveBoardsAction);
const mockedRelease = jest.mocked(releaseMyReservationsAction);

const board = (number: string, status: MapBoard["status"] = "not_yet"): MapBoard => ({
  id: number,
  number,
  name: `掲示板${number}`,
  address: "東区馬出",
  ward: "東区",
  lat: 33.6,
  long: 130.42,
  status,
});

const boards = [
  board("馬出第一-1"),
  board("馬出第一-2"),
  board("馬出第一-3", "done"),
  board("馬出第二-1"),
  board("馬出第二-2", "reserved"),
  board("箱崎-1"),
];

function renderBulk(props: Partial<ComponentProps<typeof BulkReserve>> = {}) {
  const onUpdated = jest.fn();
  render(
    <BulkReserve
      boards={boards}
      districts={["馬出第一", "馬出第二"]}
      myReservedIds={new Set()}
      onUpdated={onUpdated}
      {...props}
    />,
  );
  return onUpdated;
}

beforeEach(() => jest.resetAllMocks());

test("投票区を選んでいなくて自分の予約もなければ、何も出さない", () => {
  const { container } = render(
    <BulkReserve boards={boards} districts={[]} myReservedIds={new Set()} onUpdated={jest.fn()} />,
  );
  expect(container).toBeEmptyDOMElement();
});

test("選んでいる投票区の未貼付だけを数え、確かめてから予約する", async () => {
  const reserved = [board("馬出第一-1", "reserved"), board("馬出第一-2", "reserved")];
  mockedReserve.mockResolvedValue({
    ok: true,
    data: [...reserved, board("馬出第二-1", "reserved")],
  });
  const onUpdated = renderBulk();

  fireEvent.click(
    screen.getByRole("button", { name: "選んでいる投票区の未貼付 3か所をまとめて予約" }),
  );
  expect(screen.getByText("馬出第一・馬出第二の未貼付 3か所を予約します。")).toBeInTheDocument();
  expect(mockedReserve).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: "3か所を予約する" }));
  await waitFor(() => expect(onUpdated).toHaveBeenCalled());
  expect(mockedReserve).toHaveBeenCalledWith(["馬出第一-1", "馬出第一-2", "馬出第二-1"]);
  expect(toast.success).toHaveBeenCalledWith("3か所を予約しました。");
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
});

test("ほかの人が先に報告していた分は、予約できなかったと知らせる", async () => {
  mockedReserve.mockResolvedValue({ ok: true, data: [board("馬出第一-1", "reserved")] });
  renderBulk();
  fireEvent.click(screen.getByRole("button", { name: /まとめて予約/ }));
  fireEvent.click(screen.getByRole("button", { name: "3か所を予約する" }));
  await waitFor(() =>
    expect(toast.success).toHaveBeenCalledWith(
      "1か所を予約しました。2か所は、ほかの人が先に報告していました。",
    ),
  );
});

test("未貼付が 30 か所を超えるときはボタンを出さず、投票区を減らすよう伝える", () => {
  const many = Array.from({ length: 31 }, (_, i) => board(`香椎-${i + 1}`));
  renderBulk({ boards: many, districts: ["香椎"] });
  expect(screen.queryByRole("button", { name: /まとめて予約/ })).not.toBeInTheDocument();
  expect(screen.getByText(/未貼付は 31か所です。/)).toHaveTextContent(
    "一度に30か所までなので、投票区を減らしてください。",
  );
});

test("ちょうど 30 か所なら予約できる", () => {
  const many = Array.from({ length: 30 }, (_, i) => board(`香椎-${i + 1}`));
  renderBulk({ boards: many, districts: ["香椎"] });
  expect(
    screen.getByRole("button", { name: "選んでいる投票区の未貼付 30か所をまとめて予約" }),
  ).toBeInTheDocument();
});

test("選んでいる投票区に未貼付がなければ、そう伝える", () => {
  renderBulk({ districts: ["馬出第一"], boards: [board("馬出第一-1", "done")] });
  expect(screen.getByText("選んでいる投票区に、未貼付の掲示板はありません。")).toBeInTheDocument();
});

test("自分の予約は、投票区を選んでいなくても数えて、まとめて戻せる。予約でなくなったものは数えない", async () => {
  mockedRelease.mockResolvedValue({ ok: true, data: [board("馬出第二-2")] });
  const onUpdated = renderBulk({
    districts: [],
    myReservedIds: new Set(["馬出第二-2", "馬出第一-3"]),
  });
  fireEvent.click(screen.getByRole("button", { name: "自分の予約 1か所をまとめて未貼付に戻す" }));
  expect(screen.getByText("自分の予約 1か所を未貼付に戻します。")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "1か所を戻す" }));
  await waitFor(() => expect(onUpdated).toHaveBeenCalledWith([board("馬出第二-2")]));
  expect(toast.success).toHaveBeenCalledWith("1か所を未貼付に戻しました。");
});

test("断られたら理由を出し、ダイアログは閉じない", async () => {
  mockedReserve.mockResolvedValue({
    ok: false,
    error: "一度に予約できるのは30か所までです。投票区を減らしてください。",
  });
  const onUpdated = renderBulk();
  fireEvent.click(screen.getByRole("button", { name: /まとめて予約/ }));
  fireEvent.click(screen.getByRole("button", { name: "3か所を予約する" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("30か所までです");
  expect(onUpdated).not.toHaveBeenCalled();
});

test("reject されても、送信中のままにせず汎用の文言を出す", async () => {
  mockedRelease.mockRejectedValue(new Error("network"));
  renderBulk({ myReservedIds: new Set(["馬出第二-2"]) });
  fireEvent.click(screen.getByRole("button", { name: /まとめて未貼付に戻す/ }));
  fireEvent.click(screen.getByRole("button", { name: "1か所を戻す" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(FALLBACK_MESSAGE);
  expect(screen.getByRole("button", { name: "1か所を戻す" })).toBeEnabled();
});

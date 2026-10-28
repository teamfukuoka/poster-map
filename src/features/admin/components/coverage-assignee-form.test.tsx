import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { toast } from "sonner";
import { createCoverageAssigneeAction, updateCoverageAssigneeAction } from "../actions";
import { buildPlaces } from "../coverage-view";
import { CoverageAssigneeForm } from "./coverage-assignee-form";
import { assignee, range, SUMMARY } from "./coverage-fixtures";

jest.mock("../actions", () => ({
  createCoverageAssigneeAction: jest.fn(),
  updateCoverageAssigneeAction: jest.fn(),
}));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
const mockedCreate = jest.mocked(createCoverageAssigneeAction);
const mockedUpdate = jest.mocked(updateCoverageAssigneeAction);

const places = buildPlaces(SUMMARY);
const existing = [assignee("a1", "A班", [range({ kind: "town", ward: "東区", town: "馬出" })])];

beforeEach(() => {
  mockedCreate.mockReset();
  mockedUpdate.mockReset();
  jest.mocked(toast.success).mockReset();
});

function renderForm() {
  return render(<CoverageAssigneeForm places={places} assignees={existing} />);
}

function type(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function addBySearch(query: string, candidate: string | RegExp) {
  type("地名で探す", query);
  fireEvent.click(screen.getByRole("button", { name: candidate }));
}

const submit = () => fireEvent.click(screen.getByRole("button", { name: "登録する" }));

test("本名・電話番号・住所を入れないよう案内する", () => {
  renderForm();
  expect(screen.getByText(/本名・電話番号・住所は入れないでください/)).toBeInTheDocument();
});

test("呼び名が空なら登録できない", async () => {
  renderForm();
  addBySearch("馬出", /^東区 馬出 町名/);
  type("呼び名", "　 ");
  submit();
  expect(await screen.findByRole("alert")).toHaveTextContent("呼び名は1〜30文字で入れてください。");
  expect(mockedCreate).not.toHaveBeenCalled();
});

test("範囲が 0 個なら登録できない", async () => {
  renderForm();
  type("呼び名", "B班");
  submit();
  expect(await screen.findByRole("alert")).toHaveTextContent("範囲を1つ以上選んでください。");
  expect(mockedCreate).not.toHaveBeenCalled();
});

test("「馬出」と打つと候補に種類と掲示場の数が出る", () => {
  renderForm();
  type("地名で探す", "馬出");
  const town = screen.getByRole("button", { name: /^東区 馬出 町名/ });
  expect(town).toHaveTextContent("6か所");
  expect(screen.getByRole("button", { name: /^馬出小（校区） 校区/ })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /^東区 馬出 1丁目 丁目/ })).toBeInTheDocument();
});

test("空白を入れずに「東区馬出」と打っても、「3丁目」と打っても見つかる", () => {
  renderForm();
  type("地名で探す", "東区馬出");
  expect(screen.getByRole("button", { name: /^東区 馬出 町名/ })).toBeInTheDocument();
  type("地名で探す", "1丁目");
  expect(screen.getByRole("button", { name: /^東区 馬出 1丁目 丁目/ })).toBeInTheDocument();
});

test("候補が上限で切れたら、残りの件数を知らせる", () => {
  const many = Array.from({ length: 25 }, (_, i) => ({
    unit: "town" as const,
    ward: "東区",
    school: null,
    town: `町${String(i).padStart(2, "0")}`,
    chome: null,
    total: 1,
    assigned: 0,
    reserved: 0,
    none: 1,
    assignee_labels: [],
  }));
  render(<CoverageAssigneeForm places={buildPlaces(many)} assignees={[]} />);
  type("地名で探す", "町");
  expect(screen.getAllByRole("button", { name: /^東区 町\d\d 町名/ })).toHaveLength(20);
  expect(screen.getByText("ほか 5 件。もう少し詳しく入れてください")).toBeInTheDocument();
  type("地名で探す", "町00");
  expect(screen.queryByText(/もう少し詳しく/)).not.toBeInTheDocument();
});

test("候補を押すと「選んだ範囲」に足され、× で外せる。同じ範囲は 2 回足されない", () => {
  renderForm();
  addBySearch("馬出", /^東区 馬出 町名/);
  fireEvent.click(screen.getByRole("button", { name: /^東区 馬出 町名/ }));
  const chosen = screen.getByRole("list", { name: "選んだ範囲" });
  expect(within(chosen).getAllByRole("listitem")).toHaveLength(1);
  expect(within(chosen).getByText("東区 馬出")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "東区 馬出を外す" }));
  expect(screen.queryByRole("list", { name: "選んだ範囲" })).not.toBeInTheDocument();
});

test("区 → 校区・町名 と順に選んでも足せる", () => {
  renderForm();
  fireEvent.change(screen.getByLabelText("区"), { target: { value: "東区" } });
  fireEvent.change(screen.getByLabelText("校区・町名"), { target: { value: "town:箱崎" } });
  fireEvent.click(screen.getByRole("button", { name: "足す" }));
  const chosen = screen.getByRole("list", { name: "選んだ範囲" });
  expect(within(chosen).getByText("東区 箱崎")).toBeInTheDocument();
  // 区ぜんぶも足せる
  fireEvent.click(screen.getByRole("button", { name: "区ぜんぶを足す" }));
  expect(within(chosen).getByText("東区")).toBeInTheDocument();
});

test("既存と同じ呼び名なら知らせるが、登録は押せる", async () => {
  mockedCreate.mockResolvedValue({ ok: true, data: null });
  renderForm();
  type("呼び名", " A班 ");
  expect(screen.getByText(/同じ呼び名の担当者がいます/)).toBeInTheDocument();
  addBySearch("箱崎", /^東区 箱崎 町名/);
  const button = screen.getByRole("button", { name: "登録する" });
  expect(button).toBeEnabled();
  await act(async () => {
    fireEvent.click(button);
  });
  expect(mockedCreate).toHaveBeenCalledTimes(1);
});

test("登録できたら action に呼び名・メモ・範囲を渡し、入力を空に戻す", async () => {
  mockedCreate.mockResolvedValue({ ok: true, data: null });
  renderForm();
  type("呼び名", " B班 ");
  type("メモ", "土日のみ");
  addBySearch("箱崎", /^東区 箱崎 町名/);
  await act(async () => {
    submit();
  });
  expect(mockedCreate).toHaveBeenCalledWith("B班", "土日のみ", [
    range({ kind: "town", ward: "東区", town: "箱崎" }),
  ]);
  await waitFor(() => expect(toast.success).toHaveBeenCalledWith("登録しました"));
  expect(screen.getByLabelText("呼び名")).toHaveValue("");
  expect(screen.getByLabelText("メモ")).toHaveValue("");
  expect(screen.queryByRole("list", { name: "選んだ範囲" })).not.toBeInTheDocument();
});

test("action が失敗を返したら、その文言を role=alert で出し、入力は残す", async () => {
  mockedCreate.mockResolvedValue({
    ok: false,
    error: "選んだ範囲が掲示場のデータにありません。選び直してください。",
  });
  renderForm();
  type("呼び名", "B班");
  addBySearch("箱崎", /^東区 箱崎 町名/);
  await act(async () => {
    submit();
  });
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "選んだ範囲が掲示場のデータにありません",
  );
  expect(screen.getByLabelText("呼び名")).toHaveValue("B班");
});

test("直すときは中身入りで開き、updated_at を文字列のまま渡す", async () => {
  mockedUpdate.mockResolvedValue({ ok: true, data: null });
  const onDone = jest.fn();
  const target = assignee("a1", "A班", [range({ kind: "town", ward: "東区", town: "馬出" })], {
    note: "メモ1",
    updated_at: "2026-10-28T00:00:00.123456+00:00",
  });
  render(
    <CoverageAssigneeForm places={places} assignees={[target]} initial={target} onDone={onDone} />,
  );
  expect(screen.getByLabelText("呼び名")).toHaveValue("A班");
  expect(screen.getByLabelText("メモ")).toHaveValue("メモ1");
  expect(screen.getByText("東区 馬出")).toBeInTheDocument();
  // 自分自身の呼び名は「同じ呼び名」にしない
  expect(screen.queryByText(/同じ呼び名の担当者がいます/)).not.toBeInTheDocument();
  type("呼び名", "A班2");
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "保存する" }));
  });
  expect(mockedUpdate).toHaveBeenCalledWith(
    "a1",
    "2026-10-28T00:00:00.123456+00:00",
    "A班2",
    "メモ1",
    target.ranges,
  );
  await waitFor(() => expect(onDone).toHaveBeenCalled());
});

test("保存中にもう一度押しても、action は 1 回しか呼ばれない", async () => {
  let finish: (v: { ok: true; data: null }) => void = () => {};
  mockedCreate.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  renderForm();
  type("呼び名", "B班");
  addBySearch("箱崎", /^東区 箱崎 町名/);
  // 同じ瞬間の二度押し（描画の前）
  await act(async () => {
    submit();
    submit();
  });
  expect(mockedCreate).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("button", { name: "登録する" })).toBeDisabled();
  await act(async () => {
    finish({ ok: true, data: null });
  });
  expect(screen.getByRole("button", { name: "登録する" })).toBeEnabled();
});

test("失敗したあとはもう一度送れる", async () => {
  mockedCreate.mockResolvedValueOnce({ ok: false, error: "x" });
  mockedCreate.mockResolvedValueOnce({ ok: true, data: null });
  renderForm();
  type("呼び名", "B班");
  addBySearch("箱崎", /^東区 箱崎 町名/);
  await act(async () => {
    submit();
  });
  await act(async () => {
    submit();
  });
  expect(mockedCreate).toHaveBeenCalledTimes(2);
});

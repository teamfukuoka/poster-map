import { render, screen, within } from "@testing-library/react";
import { toUserMessage } from "../errors";
import { PIE_ORDER, statusLabels } from "../status";
import { GuideContent } from "./guide-content";

const MEDIA_LINE = /記者の方や、ほかの候補者の事務局の方などに声をかけられたら/;
const NET_LINE = /ネットで気になる投稿を見つけても/;
const TRAVEL_COST = /交通費/;

function sectionOf(name: string): HTMLElement {
  return screen.getByRole("heading", { name }).closest("section") as HTMLElement;
}

test("参加していない人には、取材・ネットの投稿への対応の行を出さない", () => {
  render(<GuideContent isVolunteer={false} />);
  expect(screen.getByRole("heading", { name: "選挙のルール（必ず守ってください）" })).toBeVisible();
  expect(screen.queryByText(MEDIA_LINE)).not.toBeInTheDocument();
  expect(screen.queryByText(NET_LINE)).not.toBeInTheDocument();
  expect(screen.queryByText(TRAVEL_COST)).not.toBeInTheDocument();
});

test("参加中の人には、取材・ネットの投稿への対応の行も出す", () => {
  render(<GuideContent isVolunteer />);
  expect(screen.getByText(MEDIA_LINE)).toBeInTheDocument();
  expect(screen.getByText(NET_LINE)).toBeInTheDocument();
  expect(screen.getByText(TRAVEL_COST)).toBeInTheDocument();
});

test("参加していない人には、設定があっても陣営内の問い合わせ先を出さない", () => {
  render(<GuideContent isVolunteer={false} volunteerContact="陣営内の窓口" />);
  const section = sectionOf("問い合わせ先");
  expect(within(section).queryByText(/陣営内の窓口/)).not.toBeInTheDocument();
  expect(within(section).getByText(/参加コードを受け取った事務局の担当者/)).toBeInTheDocument();
});

test("参加中の人には、設定された問い合わせ先を出す", () => {
  render(<GuideContent isVolunteer volunteerContact="陣営内の窓口" />);
  expect(within(sectionOf("問い合わせ先")).getByText(/陣営内の窓口/)).toBeInTheDocument();
});

test("問い合わせ先が未設定なら、参加中でも受け取った担当者を案内する", () => {
  render(<GuideContent isVolunteer />);
  expect(
    within(sectionOf("問い合わせ先")).getByText(/参加コードを受け取った事務局の担当者/),
  ).toBeInTheDocument();
});

test.each([
  false,
  true,
])("ピンの色の表は、地図と同じ並び・表示名になる（参加中: %s）", (isVolunteer) => {
  render(<GuideContent isVolunteer={isVolunteer} />);
  const rows = within(sectionOf("地図の見方")).getAllByRole("row").slice(1);
  expect(rows.map((row) => within(row).getAllByRole("cell")[1].textContent)).toEqual(
    PIE_ORDER.map((status) => statusLabels(status, isVolunteer).shortLabel),
  );
});

test("困ったときの表は、アプリが実際に出す文言を使う", () => {
  render(<GuideContent isVolunteer={false} />);
  const cells = within(sectionOf("困ったとき"))
    .getAllByRole("row")
    .slice(1)
    .map((row) => within(row).getAllByRole("cell")[0].textContent);
  for (const key of ["invalid_invite_code", "too_many_attempts", "volunteer_revoked"]) {
    expect(cells).toContain(toUserMessage({ message: key }));
  }
});

test("運営向けのメモやチェック記録は載せない", () => {
  render(<GuideContent isVolunteer />);
  expect(screen.queryByText(/運営メモ/)).not.toBeInTheDocument();
  expect(screen.queryByText(/チェック記録/)).not.toBeInTheDocument();
});

test("予約の説明：ほかの人へのお知らせ・すぐ貼れるなら完了だけ・時間では消えない", () => {
  render(<GuideContent isVolunteer={false} />);
  const section = sectionOf("報告する");
  const rows = within(section)
    .getAllByRole("row")
    .slice(1)
    .map((row) => row.textContent);
  expect(rows).toContainEqual(expect.stringMatching(/その場ですぐ貼れるとき.*完了だけ/));
  expect(within(section).getByText(/「ここには私が行きます」/)).toBeInTheDocument();
  expect(within(section).getByText(/予約は時間がたっても消えません/)).toBeInTheDocument();
});

test("参加していない人には、ガイドのどこにも「他候補」と出さない", () => {
  const { container } = render(<GuideContent isVolunteer={false} />);
  expect(container.textContent).not.toContain("他候補");
  expect(container.textContent).not.toContain("ほかのポスター");
  expect(container.textContent).toContain("要確認");
});

test("参加中の人には、他候補のポスターがあるときの報告のしかたを出す", () => {
  render(<GuideContent isVolunteer />);
  expect(screen.getByText(/貼る区画にほかのポスターがある/)).toBeInTheDocument();
});

test("ポスター貼りの流れを、投票区で探す→予約→完了→行けなければ未貼付に戻す、の順で書く", () => {
  render(<GuideContent isVolunteer={false} />);
  const steps = within(sectionOf("ポスター貼りの流れ"))
    .getAllByRole("listitem")
    .map((item) => item.textContent ?? "");
  const order = ["投票区", "「予約」", "「完了」", "「未貼付」に戻す"].map((word) =>
    steps.findIndex((step) => step.includes(word)),
  );
  expect(order.every((index) => index >= 0)).toBe(true);
  expect(order).toEqual([...order].sort((a, b) => a - b));
  expect(steps[0]).toMatch(/担当が複数あるときは、続けて選ぶと足していけます/);
});

test("まとめて予約（一度に30か所まで）と、自分の予約をまとめて戻すことを書く", () => {
  render(<GuideContent isVolunteer={false} />);
  const flow = sectionOf("ポスター貼りの流れ");
  expect(within(flow).getByText(/まとめて予約できます（一度に30か所まで）/)).toBeInTheDocument();
  expect(within(flow).getByText(/自分の予約を一度に戻せます/)).toBeInTheDocument();
  const report = sectionOf("報告する");
  expect(within(report).getByText(/一度に予約できるのは30\s*か所までです/)).toBeInTheDocument();
  expect(
    within(report).getByText(/先にピンから「完了」で報告してから使ってください/),
  ).toBeInTheDocument();
});

const STICKER_HEADING = "シール貼り（ポスターシール貼りチャレンジ）";

test.each([
  { isVolunteer: false, stickerEnabled: false },
  { isVolunteer: true, stickerEnabled: false },
])("シールを始めていなければ、シール貼りの項も目次も出さない（参加中: $isVolunteer）", (props) => {
  render(<GuideContent {...props} />);
  expect(screen.queryByRole("heading", { name: STICKER_HEADING })).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: STICKER_HEADING })).not.toBeInTheDocument();
  expect(screen.queryByText(/ポスターシール貼りチャレンジ」の期間です/)).not.toBeInTheDocument();
});

test("シールを始めていれば、冒頭の案内・目次・シール貼りの項を出す", () => {
  render(<GuideContent isVolunteer stickerEnabled />);
  expect(screen.getByText(/ポスターシール貼りチャレンジ」の期間です/)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: STICKER_HEADING })).toHaveAttribute("href", "#sticker");
  const section = sectionOf(STICKER_HEADING);
  expect(section).toHaveAttribute("id", "sticker");
  // 目次の順：ポスター貼りの流れのすぐ後
  const toc = within(screen.getByRole("navigation", { name: "目次" }))
    .getAllByRole("link")
    .map((a) => a.textContent);
  expect(toc[toc.indexOf("ポスター貼りの流れ") + 1]).toBe(STICKER_HEADING);
});

test("シールの色の表は、地図のフィルターと同じ並び・表示名になる", () => {
  render(<GuideContent isVolunteer stickerEnabled />);
  const rows = within(sectionOf(STICKER_HEADING)).getAllByRole("row").slice(1);
  expect(rows.map((row) => within(row).getAllByRole("cell")[1].textContent)).toEqual([
    "完了",
    "予約",
    "未",
    "問題あり",
    "対象外",
  ]);
});

test("シール貼りの流れを、予約→シール完了→シール未に戻す、の順で書く", () => {
  render(<GuideContent isVolunteer stickerEnabled />);
  const items = within(sectionOf(STICKER_HEADING))
    .getAllByRole("listitem")
    .map((item) => item.textContent ?? "");
  const order = ["「予約」", "「シール完了」", "「シール未」に戻す"].map((word) =>
    items.findIndex((item) => item.includes(word)),
  );
  expect(order.every((index) => index >= 0)).toBe(true);
  expect(order).toEqual([...order].sort((a, b) => a - b));
});

test("シールを貼るときに守ること：表示を隠さない・他候補に触らない・11/15 は貼らない", () => {
  render(<GuideContent isVolunteer stickerEnabled />);
  const section = sectionOf(STICKER_HEADING);
  expect(
    within(section).getByText(/掲示責任者と印刷者の表示は、シールで隠さない/),
  ).toBeInTheDocument();
  expect(within(section).getByText(/ほかの候補者のポスターには触らない/)).toBeInTheDocument();
  expect(within(section).getByText(/11\/15（日）の投票日は、貼りに行かない/)).toBeInTheDocument();
  expect(within(section).getByText(/貼る位置は、事務局の案内に従って/)).toBeInTheDocument();
});

test("シール貼りの項に、投票を呼びかける言葉を入れない", () => {
  render(<GuideContent isVolunteer stickerEnabled />);
  expect(sectionOf(STICKER_HEADING).textContent).not.toMatch(/投票に行|投票して|一票|応援して/);
});

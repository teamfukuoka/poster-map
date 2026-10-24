import { render, screen, within } from "@testing-library/react";
import { toUserMessage } from "../errors";
import { PIE_ORDER, STATUS_CONFIG } from "../status";
import { GuideContent } from "./guide-content";

const MEDIA_LINE = /記者の方や、ほかの陣営の方などに声をかけられたら/;
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
  expect(within(section).getByText(/参加コードを受け取った陣営の担当者/)).toBeInTheDocument();
});

test("参加中の人には、設定された問い合わせ先を出す", () => {
  render(<GuideContent isVolunteer volunteerContact="陣営内の窓口" />);
  expect(within(sectionOf("問い合わせ先")).getByText(/陣営内の窓口/)).toBeInTheDocument();
});

test("問い合わせ先が未設定なら、参加中でも受け取った担当者を案内する", () => {
  render(<GuideContent isVolunteer />);
  expect(
    within(sectionOf("問い合わせ先")).getByText(/参加コードを受け取った陣営の担当者/),
  ).toBeInTheDocument();
});

test("ピンの色の表は、地図の状況の設定と同じ並び・表示名になる", () => {
  render(<GuideContent isVolunteer={false} />);
  const rows = within(sectionOf("地図の見方")).getAllByRole("row").slice(1);
  expect(rows.map((row) => within(row).getAllByRole("cell")[1].textContent)).toEqual(
    PIE_ORDER.map((status) => STATUS_CONFIG[status].shortLabel),
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

import { render, screen, within } from "@testing-library/react";
import PrivacyPage from "./page";

const ENV_KEYS = ["OPERATOR_NAME", "CONTACT", "SOURCE_URL"] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of ENV_KEYS) saved[key] = process.env[key];
  process.env.OPERATOR_NAME = "（未定）";
  process.env.CONTACT = "example@example.invalid";
  process.env.SOURCE_URL = "https://example.invalid/source";
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

test("参加した方について保存するものは、書いた数と項目の数が一致し、DB に保存するものを含む", () => {
  render(<PrivacyPage />);
  const section = screen.getByRole("heading", { name: "参加コードで参加した方" })
    .parentElement as HTMLElement;
  const lead = within(section).getByText(/^保存するのは、次の \d つです。$/);
  const count = Number(lead.textContent?.match(/\d/)?.[0]);
  const items = within(section)
    .getAllByRole("listitem")
    .map((li) => li.textContent);
  expect(items).toHaveLength(count);
  // public.volunteers（display_name・invite_code_id・created_at）、
  // private.invite_code_failures、poster_board_status_history に対応する
  expect(items).toEqual(
    expect.arrayContaining([
      expect.stringContaining("ニックネーム"),
      expect.stringContaining("Cookie"),
      expect.stringContaining("参加コードの種類"),
      expect.stringContaining("参加した日時"),
      expect.stringContaining("参加コードの入力に失敗した日時"),
      expect.stringContaining("報告の内容"),
    ]),
  );
});

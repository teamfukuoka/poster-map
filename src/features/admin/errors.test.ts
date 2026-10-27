import { FALLBACK_MESSAGE } from "@/features/poster-map/errors";
import { toAdminMessage } from "./errors";

test.each([
  ["not_admin", "このアカウントでは管理画面に入れません。管理者に一覧への追加を頼んでください。"],
  ["forbidden", "この操作は管理者だけができます。"],
  [
    "invalid_invite_code_format",
    "参加コードは8〜64文字で、英字・数字・記号をそれぞれ1つ以上入れてください。空白は使えません。",
  ],
  ["invalid_label", "配布先の名前は1〜50文字で入れてください。"],
  ["duplicate_invite_code", "同じ参加コードがすでに登録されています。別のコードにしてください。"],
  [
    "invite_code_not_found",
    "参加コードが見つからないか、すでに失効しています。画面を更新してください。",
  ],
  ["reset_closed", "11月1日0:00を過ぎたため、報告をまとめて戻すことはできません。"],
  ["confirm_mismatch", "確認の文字が違います。画面に書かれた文字をそのまま入れてください。"],
  ["not_accepted", "受理を確かめる前は、「公開する」から公開してください。"],
  ["before_public_from", "公開期間の始まり（11月1日0:00）より前は公開できません。"],
])("RPC の例外 %s を文言にする", (code, message) => {
  expect(toAdminMessage({ code: "P0001", message: code })).toBe(message);
  expect(toAdminMessage({ code })).toBe(message);
});

test("知らないエラー・null・undefined は共通の文言", () => {
  expect(toAdminMessage({ message: "connection refused" })).toBe(FALLBACK_MESSAGE);
  expect(toAdminMessage(null)).toBe(FALLBACK_MESSAGE);
  expect(toAdminMessage(undefined)).toBe(FALLBACK_MESSAGE);
});

test("Object の組み込みのプロパティ名は共通の文言", () => {
  expect(toAdminMessage({ message: "constructor" })).toBe(FALLBACK_MESSAGE);
  expect(toAdminMessage({ code: "toString" })).toBe(FALLBACK_MESSAGE);
  expect(toAdminMessage({ message: "__proto__" })).toBe(FALLBACK_MESSAGE);
});

test("poster-map 側の文言は管理画面では使わない", () => {
  expect(toAdminMessage({ message: "invalid_invite_code" })).toBe(FALLBACK_MESSAGE);
});

test("カバー地域のエラーは文言になる", () => {
  expect(toAdminMessage({ message: "stale_assignee" })).toBe(
    "ほかの人が先に直しました。開き直してください",
  );
  expect(toAdminMessage({ message: "assignee_not_found" })).toBe(
    "この担当者はもう外されています。開き直してください",
  );
  expect(toAdminMessage({ message: "invalid_coverage_ranges" })).toBe(
    "範囲を1つ以上選んでください。",
  );
});

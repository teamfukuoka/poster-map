import { auditActionLabel, auditTargetLabel } from "./audit-labels";

test.each([
  ["set_force_hidden", "公開の切り替え"],
  ["reset_rehearsal", "報告をまとめて戻す"],
  ["register_invite_code", "参加コードの登録"],
  ["revoke_invite_code", "参加コードの失効"],
  ["reveal_invite_code", "参加コードの表示"],
  ["publish", "公開（受理後の名前に切り替え）"],
  ["revert_acceptance", "受理前に戻す"],
])("%s は「%s」", (action, label) => {
  expect(auditActionLabel(action)).toBe(label);
});

test("知らない操作はそのまま出す", () => {
  expect(auditActionLabel("something_new")).toBe("something_new");
});

test("組み込みのプロパティ名は、そのまま出す（ラベルにしない）", () => {
  expect(auditActionLabel("constructor")).toBe("constructor");
  expect(auditActionLabel("toString")).toBe("toString");
});

test("まとめ戻しの対象は消した件数として読む", () => {
  expect(auditTargetLabel("reset_rehearsal", "12")).toBe("履歴12件を消した");
  expect(auditTargetLabel("reset_rehearsal", "0")).toBe("履歴0件を消した");
});

test("公開の切り替えの対象は、止めた／再開したとして読む", () => {
  expect(auditTargetLabel("set_force_hidden", "true")).toBe("止めた");
  expect(auditTargetLabel("set_force_hidden", "false")).toBe("再開した");
});

test("そのほかは対象をそのまま出し、空は「—」", () => {
  expect(auditTargetLabel("publish", "佐々木あやの ポスター掲示板マップ")).toBe(
    "佐々木あやの ポスター掲示板マップ",
  );
  expect(auditTargetLabel("revert_acceptance", null)).toBe("—");
  expect(auditTargetLabel("reveal_invite_code", "")).toBe("—");
});

test("読めない値はそのまま出す", () => {
  expect(auditTargetLabel("reset_rehearsal", "abc")).toBe("abc");
  expect(auditTargetLabel("set_force_hidden", "maybe")).toBe("maybe");
});

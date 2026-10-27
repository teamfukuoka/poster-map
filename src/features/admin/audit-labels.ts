const ACTION_LABELS: Record<string, string> = {
  set_force_hidden: "公開の切り替え",
  reset_rehearsal: "報告をまとめて戻す",
  register_invite_code: "参加コードの登録",
  revoke_invite_code: "参加コードの失効",
  reveal_invite_code: "参加コードの表示",
  publish: "公開（受理後の名前に切り替え）",
  revert_acceptance: "受理前に戻す",
  coverage_assignee_create: "担当者の登録",
  coverage_assignee_update: "担当者の変更",
  coverage_assignee_delete: "担当者を外す",
};

/** 操作の記録の「操作」。知らない操作はそのまま出す */
export function auditActionLabel(action: string): string {
  // "constructor" などで Object の組み込みのプロパティを返さないよう、自前のキーだけを見る
  return Object.hasOwn(ACTION_LABELS, action) ? ACTION_LABELS[action] : action;
}

/**
 * 操作の記録の「対象」。DB には操作ごとに短い値（true/false・消した件数・名前）が入っている。
 * 読める形にできるものだけ直し、ほかはそのまま出す（空は「—」）
 */
export function auditTargetLabel(action: string, target: string | null): string {
  if (target === null || target === "") return "—";
  if (action === "set_force_hidden") {
    if (target === "true") return "止めた";
    if (target === "false") return "再開した";
  }
  if (action === "reset_rehearsal" && /^\d+$/.test(target)) {
    return `履歴${target}件を消した`;
  }
  return target;
}

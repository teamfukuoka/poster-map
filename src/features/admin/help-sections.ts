/** 管理画面のヘルプ（/admin/help）の目次。見出しの「くわしく」は helpHref で各節に飛ぶ */
export const HELP_SECTIONS = [
  { id: "overview", title: "この管理画面でできること" },
  { id: "roles", title: "管理者と運営" },
  { id: "schedule", title: "日程" },
  {
    id: "dashboard",
    title: "最初の画面",
    href: "/admin",
    topics: [
      { id: "dashboard-stale", title: "長く残っている予約" },
      { id: "dashboard-danger", title: "「危険」の報告" },
      { id: "dashboard-reports", title: "新しい連絡事項（直近24時間）" },
      { id: "dashboard-wards", title: "区ごとの進み具合" },
    ],
  },
  {
    id: "codes",
    title: "参加コード",
    href: "/admin/codes",
    topics: [
      { id: "codes-register", title: "参加コードを登録する" },
      { id: "codes-list", title: "登録されている参加コード" },
      { id: "codes-share", title: "参加コードの配り方" },
    ],
  },
  {
    id: "coverage",
    title: "カバー地域",
    href: "/admin/coverage",
    topics: [
      { id: "coverage-totals", title: "全体の数" },
      { id: "coverage-table", title: "地域ごとの数" },
      { id: "coverage-map", title: "地図" },
      { id: "coverage-register", title: "担当者を登録する" },
      { id: "coverage-assignees", title: "登録済みの担当者" },
    ],
  },
  {
    id: "site",
    title: "公開とリセット",
    href: "/admin/site",
    topics: [
      { id: "site-status", title: "いまの設定" },
      { id: "site-publish", title: "公開の切り替え" },
      { id: "site-reset", title: "報告をまとめて戻す" },
    ],
  },
  {
    id: "members",
    title: "管理メンバー",
    href: "/admin/members",
    topics: [
      { id: "members-add", title: "管理メンバーを登録する" },
      { id: "members-list", title: "管理画面に入れる人" },
    ],
  },
  { id: "audit", title: "操作の記録", href: "/admin/audit" },
  { id: "day1", title: "11月1日の流れ" },
  { id: "daily", title: "毎日の確認" },
  { id: "trouble", title: "困ったとき" },
  { id: "donts", title: "しないこと" },
] as const satisfies readonly HelpSection[];

type HelpSection = {
  id: string;
  title: string;
  href?: string;
  topics?: readonly { id: string; title: string }[];
};

type Section = (typeof HELP_SECTIONS)[number];
type Topic = Extract<Section, { topics: unknown }>["topics"][number];

export type HelpSectionId = Section["id"];
export type HelpId = HelpSectionId | Topic["id"];

export const HELP_PATH = "/admin/help";

export function helpHref(id: HelpId): string {
  return `${HELP_PATH}#${id}`;
}

/** 節か小見出しの名前。リンクの読み上げに使う */
export function helpTitle(id: HelpId): string {
  for (const section of HELP_SECTIONS) {
    if (section.id === id) return section.title;
    for (const topic of "topics" in section ? section.topics : []) {
      if (topic.id === id) return topic.title;
    }
  }
  return id;
}

// カバー地域の部品テストで使う見本。実在の人名は入れない（呼び名は「A班」など）。
import type {
  CoverageAssignee,
  CoverageBoard,
  CoverageKind,
  CoverageRange,
  CoverageSummaryRow,
} from "../types";

export const range = (r: Partial<CoverageRange> & { kind: CoverageKind }): CoverageRange => ({
  ward: null,
  school: null,
  town: null,
  chome: null,
  ...r,
});

export const row = (
  r: Partial<CoverageSummaryRow> & { unit: CoverageKind },
): CoverageSummaryRow => ({
  ward: null,
  school: null,
  town: null,
  chome: null,
  total: 0,
  assigned: 0,
  reserved: 0,
  none: 0,
  assignee_labels: [],
  ...r,
});

export const board = (b: Partial<CoverageBoard> & { board_id: string }): CoverageBoard => ({
  address: "福岡市東区馬出1-1",
  assignee_labels: [],
  chome: "1丁目",
  coverage: "none",
  lat: 33.6,
  long: 130.4,
  name: "",
  number: "東-001",
  school: "馬出小",
  school_source: "csv",
  status: "not_yet",
  town: "馬出",
  ward: "東区",
  ...b,
});

export const assignee = (
  id: string,
  label: string,
  ranges: CoverageRange[],
  extra: Partial<CoverageAssignee> = {},
): CoverageAssignee => ({
  id,
  label,
  note: "",
  updated_at: "2026-10-28T00:00:00.123456+00:00",
  ranges,
  board_count: 0,
  ...extra,
});

/** 区 2 つ・校区 2 つ・町名 3 つ・丁目 2 つの小さな集計 */
export const SUMMARY: CoverageSummaryRow[] = [
  row({ unit: "ward", ward: "東区", total: 10, assigned: 4, reserved: 2, none: 4 }),
  row({ unit: "ward", ward: "南区", total: 5, assigned: 5, none: 0 }),
  row({ unit: "school", ward: "東区", school: "馬出小", total: 6, assigned: 4, none: 2 }),
  row({ unit: "school", ward: "東区", school: null, total: 4, reserved: 2, none: 2 }),
  row({ unit: "school", ward: "南区", school: "宮竹小", total: 5, assigned: 5, none: 0 }),
  row({
    unit: "town",
    ward: "東区",
    town: "馬出",
    total: 6,
    assigned: 4,
    none: 2,
    assignee_labels: ["A班", "B班", "C班", "D班", "E班"],
  }),
  row({ unit: "town", ward: "東区", town: "箱崎", total: 4, reserved: 2, none: 2 }),
  row({ unit: "town", ward: "南区", town: "桧原", total: 5, assigned: 5, none: 0 }),
  row({ unit: "chome", ward: "東区", town: "馬出", chome: "1丁目", total: 4, assigned: 4 }),
  row({ unit: "chome", ward: "東区", town: "馬出", chome: "2丁目", total: 2, none: 2 }),
];

export const BOARDS: CoverageBoard[] = [
  board({ board_id: "b1", number: "東-001", coverage: "assigned", assignee_labels: ["A班"] }),
  board({
    board_id: "b2",
    number: "東-002",
    address: "福岡市東区馬出2-2",
    chome: "2丁目",
    coverage: "none",
    status: "done",
  }),
  board({
    board_id: "b3",
    number: "東-003",
    address: "福岡市東区箱崎3-3",
    town: "箱崎",
    chome: "3丁目",
    school: null,
    coverage: "reserved",
    status: "reserved",
  }),
];

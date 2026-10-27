import {
  insertBoard,
  resetDatabase,
  setAdminSettings,
  setBoardArea,
  signInStaff,
  type TestClient,
  withPg,
} from "./helpers";

beforeEach(async () => {
  await resetDatabase();
});

type Range = {
  kind: "ward" | "school" | "town" | "chome";
  ward?: string | null;
  school?: string | null;
  town?: string | null;
  chome?: string | null;
};

async function createAssignee(
  client: TestClient,
  ranges: Range[],
  label = "田中さん",
  note = "",
): Promise<string> {
  const { data, error } = await client.rpc("admin_create_coverage_assignee", {
    p_label: label,
    p_note: note,
    p_ranges: ranges,
  });
  expect(error).toBeNull();
  return data as string;
}

async function listAssignees(client: TestClient) {
  const { data, error } = await client.rpc("admin_coverage_assignees");
  expect(error).toBeNull();
  return data ?? [];
}

async function listBoards(client: TestClient) {
  const { data, error } = await client.rpc("admin_coverage_boards");
  expect(error).toBeNull();
  return data ?? [];
}

async function summary(client: TestClient) {
  const { data, error } = await client.rpc("admin_coverage_summary");
  expect(error).toBeNull();
  return data ?? [];
}

function coverageOf(boards: Awaited<ReturnType<typeof listBoards>>, number: string) {
  return boards.find((b) => b.number === number)?.coverage;
}

describe("権限", () => {
  test("一覧にない人は not_admin", async () => {
    const { client } = await signInStaff(null);
    const id = "00000000-0000-0000-0000-000000000000";
    const calls = [
      client.rpc("admin_coverage_summary"),
      client.rpc("admin_coverage_boards"),
      client.rpc("admin_coverage_assignees"),
      client.rpc("admin_create_coverage_assignee", {
        p_label: "a",
        p_note: "",
        p_ranges: [{ kind: "ward", ward: "中央区" }],
      }),
      client.rpc("admin_update_coverage_assignee", {
        p_id: id,
        p_expected_updated_at: new Date().toISOString(),
        p_label: "a",
        p_note: "",
        p_ranges: [{ kind: "ward", ward: "中央区" }],
      }),
      client.rpc("admin_delete_coverage_assignee", {
        p_id: id,
        p_expected_updated_at: new Date().toISOString(),
      }),
    ];
    for (const result of await Promise.all(calls)) {
      expect(result.error?.message).toBe("not_admin");
    }
  });

  test("operator が登録・直す・外すをできる", async () => {
    await insertBoard("1", "not_yet", "中央区");
    const { client } = await signInStaff("operator");
    const id = await createAssignee(client, [{ kind: "ward", ward: "中央区" }]);
    let rows = await listAssignees(client);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(id);
    expect(rows[0].label).toBe("田中さん");
    expect(rows[0].ranges).toEqual([
      { kind: "ward", ward: "中央区", school: null, town: null, chome: null },
    ]);
    expect(rows[0].board_count).toBe(1);

    const first = rows[0].updated_at;
    const update = await client.rpc("admin_update_coverage_assignee", {
      p_id: id,
      p_expected_updated_at: first,
      p_label: "山田さん",
      p_note: "平日の夜",
      p_ranges: [{ kind: "ward", ward: "中央区" }],
    });
    expect(update.error).toBeNull();
    rows = await listAssignees(client);
    expect(rows[0].label).toBe("山田さん");
    expect(rows[0].note).toBe("平日の夜");
    expect(new Date(rows[0].updated_at).getTime()).toBeGreaterThan(new Date(first).getTime());

    const del = await client.rpc("admin_delete_coverage_assignee", {
      p_id: id,
      p_expected_updated_at: rows[0].updated_at,
    });
    expect(del.error).toBeNull();
    expect(await listAssignees(client)).toHaveLength(0);
  });
});

describe("判定", () => {
  test("区の範囲はその区の掲示場だけ", async () => {
    await insertBoard("1", "not_yet", "中央区");
    await insertBoard("2", "not_yet", "中央区");
    await insertBoard("3", "not_yet", "東区");
    const { client } = await signInStaff("operator");
    await createAssignee(client, [{ kind: "ward", ward: "中央区" }]);
    const boards = await listBoards(client);
    expect(boards.filter((b) => b.coverage === "assigned")).toHaveLength(2);
    expect(boards.filter((b) => b.coverage === "none")).toHaveLength(1);
    expect(coverageOf(boards, "3")).toBe("none");
  });

  test("同じ町名でも区が違えば含まない", async () => {
    await insertBoard("1", "not_yet", "中央区");
    await insertBoard("2", "not_yet", "城南区");
    await setBoardArea("1", { school: "A小", town: "鳥飼" });
    await setBoardArea("2", { school: "B小", town: "鳥飼" });
    const { client } = await signInStaff("operator");
    await createAssignee(client, [{ kind: "town", ward: "中央区", town: "鳥飼" }]);
    const boards = await listBoards(client);
    expect(coverageOf(boards, "1")).toBe("assigned");
    expect(coverageOf(boards, "2")).toBe("none");
  });

  test("校区は区をまたいで含み、集計は区ごとに分かれる", async () => {
    await insertBoard("1", "not_yet", "南区");
    await insertBoard("2", "not_yet", "博多区");
    await setBoardArea("1", { school: "宮竹小", town: "屋形原" });
    await setBoardArea("2", { school: "宮竹小", town: "東比恵" });
    const { client } = await signInStaff("operator");
    await createAssignee(client, [{ kind: "school", school: "宮竹小" }]);
    const boards = await listBoards(client);
    expect(coverageOf(boards, "1")).toBe("assigned");
    expect(coverageOf(boards, "2")).toBe("assigned");
    const rows = (await summary(client)).filter((r) => r.unit === "school");
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((r) => r.ward))).toEqual(new Set(["南区", "博多区"]));
    for (const row of rows) {
      expect(row.school).toBe("宮竹小");
      expect(row.total).toBe(1);
      expect(row.assigned).toBe(1);
    }
  });

  test("丁目の範囲はその丁目だけ", async () => {
    await insertBoard("1", "not_yet", "東区");
    await insertBoard("2", "not_yet", "東区");
    await insertBoard("3", "not_yet", "東区");
    await setBoardArea("1", { school: "A小", town: "馬出", chome: "1" });
    await setBoardArea("2", { school: "A小", town: "馬出", chome: "3" });
    await setBoardArea("3", { school: "A小", town: "箱崎" });
    const { client } = await signInStaff("operator");
    await createAssignee(client, [{ kind: "chome", ward: "東区", town: "馬出", chome: "3" }]);
    const boards = await listBoards(client);
    expect(coverageOf(boards, "1")).toBe("none");
    expect(coverageOf(boards, "2")).toBe("assigned");
    expect(coverageOf(boards, "3")).toBe("none");
    const chomeRows = (await summary(client)).filter((r) => r.unit === "chome");
    expect(chomeRows).toHaveLength(2);
    expect(chomeRows.map((r) => r.chome).sort()).toEqual(["1", "3"]);
  });

  test("判定の順位: 担当あり、予約か完了、ほか", async () => {
    await insertBoard("1", "reserved", "中央区");
    await insertBoard("2", "done", "東区");
    await insertBoard("3", "not_yet_dangerous", "東区");
    await insertBoard("4", "not_yet", "東区");
    const { client } = await signInStaff("operator");
    await createAssignee(client, [{ kind: "ward", ward: "中央区" }]);
    const boards = await listBoards(client);
    expect(coverageOf(boards, "1")).toBe("assigned");
    expect(coverageOf(boards, "2")).toBe("reserved");
    expect(coverageOf(boards, "3")).toBe("none");
    expect(coverageOf(boards, "4")).toBe("none");
    const wards = (await summary(client)).filter((r) => r.unit === "ward");
    expect(wards).toHaveLength(2);
    for (const row of wards) {
      expect(row.assigned + row.reserved + row.none).toBe(row.total);
    }
    const east = wards.find((r) => r.ward === "東区");
    expect([east?.total, east?.assigned, east?.reserved, east?.none]).toEqual([3, 0, 1, 2]);
    expect(east?.assignee_labels).toEqual([]);
    const central = wards.find((r) => r.ward === "中央区");
    expect(central?.assignee_labels).toEqual(["田中さん"]);
  });

  test("表にない掲示場は school_source などが null で、校区・町名の行には「なし」として集計される", async () => {
    await insertBoard("1", "not_yet", "中央区");
    await insertBoard("2", "not_yet", "中央区");
    await setBoardArea("2", { school: "A小", town: "天神", chome: "2" });
    const { client } = await signInStaff("operator");
    const boards = await listBoards(client);
    const without = boards.find((b) => b.number === "1");
    expect(without?.school).toBeNull();
    expect(without?.school_source).toBeNull();
    expect(without?.town).toBeNull();
    expect(without?.chome).toBeNull();
    const withArea = boards.find((b) => b.number === "2");
    expect(withArea?.school).toBe("A小");
    expect(withArea?.school_source).toBe("pdf");
    expect(withArea?.chome).toBe("2");

    const rows = await summary(client);
    const schools = rows.filter((r) => r.unit === "school");
    expect(schools.reduce((n, r) => n + r.total, 0)).toBe(2);
    expect(schools.some((r) => r.school === null && r.total === 1)).toBe(true);
    const towns = rows.filter((r) => r.unit === "town");
    expect(towns.reduce((n, r) => n + r.total, 0)).toBe(2);
    expect(rows.filter((r) => r.unit === "chome")).toHaveLength(1);
  });

  test("board_count は重なりを 1 回だけ数える", async () => {
    await insertBoard("1", "not_yet", "中央区");
    await insertBoard("2", "not_yet", "中央区");
    await insertBoard("3", "not_yet", "東区");
    await setBoardArea("1", { school: "A小", town: "天神" });
    await setBoardArea("2", { school: "A小", town: "大名" });
    const { client } = await signInStaff("operator");
    await createAssignee(client, [
      { kind: "ward", ward: "中央区" },
      { kind: "town", ward: "中央区", town: "天神" },
    ]);
    const rows = await listAssignees(client);
    expect(rows[0].board_count).toBe(2);
  });
});

describe("登録の入力", () => {
  beforeEach(async () => {
    await insertBoard("1", "not_yet", "中央区");
  });

  const ok: Range[] = [{ kind: "ward", ward: "中央区" }];

  test("呼び名は全角の空白も取る", async () => {
    const { client } = await signInStaff("operator");
    await createAssignee(client, ok, "　田中さん ");
    expect((await listAssignees(client))[0].label).toBe("田中さん");
  });

  test("呼び名が空・31 文字は invalid_assignee_label、30 文字は通る", async () => {
    const { client } = await signInStaff("operator");
    for (const label of ["　 ", "", "あ".repeat(31)]) {
      const { error } = await client.rpc("admin_create_coverage_assignee", {
        p_label: label,
        p_note: "",
        p_ranges: ok,
      });
      expect(error?.message).toBe("invalid_assignee_label");
    }
    await createAssignee(client, ok, "あ".repeat(30));
    expect(await listAssignees(client)).toHaveLength(1);
  });

  test("メモは 200 文字まで", async () => {
    const { client } = await signInStaff("operator");
    const tooLong = await client.rpc("admin_create_coverage_assignee", {
      p_label: "a",
      p_note: "あ".repeat(201),
      p_ranges: ok,
    });
    expect(tooLong.error?.message).toBe("invalid_assignee_note");
    await createAssignee(client, ok, "a", "あ".repeat(200));
    expect(await listAssignees(client)).toHaveLength(1);
  });

  test("範囲の形が違えば invalid_coverage_ranges", async () => {
    const { client } = await signInStaff("operator");
    const bad: unknown[] = [
      [],
      {},
      "ward",
      [{ kind: "prefecture", ward: "中央区" }],
      [{ ward: "中央区" }],
      [{ kind: "ward", ward: "中央区", school: "A小" }],
      [{ kind: "ward" }],
      [{ kind: "ward", ward: "" }],
      [{ kind: "school", school: "A小", ward: "中央区" }],
      [{ kind: "town", ward: "中央区" }],
      [{ kind: "chome", ward: "中央区", town: "天神" }],
      [{ kind: "chome", ward: "中央区", town: "天神", chome: "1", school: "A小" }],
      [{ kind: "ward", ward: 1 }],
      ["ward"],
    ];
    for (const p_ranges of bad) {
      const { error } = await client.rpc("admin_create_coverage_assignee", {
        p_label: "a",
        p_note: "",
        p_ranges: p_ranges as never,
      });
      expect([JSON.stringify(p_ranges), error?.message]).toEqual([
        JSON.stringify(p_ranges),
        "invalid_coverage_ranges",
      ]);
    }
    expect(await listAssignees(client)).toHaveLength(0);
  });

  test("null の項目は付いていてもよい", async () => {
    const { client } = await signInStaff("operator");
    await createAssignee(client, [
      { kind: "ward", ward: "中央区", school: null, town: null, chome: null },
    ]);
    expect(await listAssignees(client)).toHaveLength(1);
  });

  test("掲示場のデータにない地名は unknown_coverage_place", async () => {
    await insertBoard("2", "not_yet", "城南区");
    await setBoardArea("1", { school: "A小", town: "天神", chome: "1" });
    await setBoardArea("2", { school: "B小", town: "鳥飼" });
    const { client } = await signInStaff("operator");
    const unknown: Range[][] = [
      [{ kind: "ward", ward: "北区" }],
      [{ kind: "school", school: "C小" }],
      [{ kind: "town", ward: "城南区", town: "天神" }],
      [{ kind: "chome", ward: "中央区", town: "天神", chome: "2" }],
      [
        { kind: "ward", ward: "中央区" },
        { kind: "ward", ward: "北区" },
      ],
    ];
    for (const ranges of unknown) {
      const { error } = await client.rpc("admin_create_coverage_assignee", {
        p_label: "a",
        p_note: "",
        p_ranges: ranges,
      });
      expect([JSON.stringify(ranges), error?.message]).toEqual([
        JSON.stringify(ranges),
        "unknown_coverage_place",
      ]);
    }
    await createAssignee(client, [{ kind: "chome", ward: "中央区", town: "天神", chome: "1" }]);
    expect(await listAssignees(client)).toHaveLength(1);
  });

  test("同じ範囲が 2 回あれば 1 つにまとめる", async () => {
    const { client } = await signInStaff("operator");
    await createAssignee(client, [ok[0], ok[0]]);
    expect((await listAssignees(client))[0].ranges).toHaveLength(1);
  });

  test("範囲の並びは kind の順、次に地名の順", async () => {
    await insertBoard("2", "not_yet", "東区");
    await setBoardArea("1", { school: "A小", town: "天神", chome: "1" });
    await setBoardArea("2", { school: "B小", town: "箱崎", chome: "2" });
    const { client } = await signInStaff("operator");
    await createAssignee(client, [
      { kind: "chome", ward: "中央区", town: "天神", chome: "1" },
      { kind: "town", ward: "東区", town: "箱崎" },
      { kind: "school", school: "B小" },
      { kind: "ward", ward: "東区" },
      { kind: "school", school: "A小" },
      { kind: "ward", ward: "中央区" },
    ]);
    const kinds = ((await listAssignees(client))[0].ranges as Range[]).map(
      (r) => `${r.kind}:${r.ward ?? r.school}`,
    );
    expect(kinds).toEqual([
      "ward:中央区",
      "ward:東区",
      "school:A小",
      "school:B小",
      "town:東区",
      "chome:中央区",
    ]);
  });
});

describe("ぶつかったとき", () => {
  const ranges: Range[] = [{ kind: "ward", ward: "中央区" }];

  beforeEach(async () => {
    await insertBoard("1", "not_yet", "中央区");
  });

  test("古い updated_at で update すると stale_assignee で、中身は変わらない", async () => {
    const { client } = await signInStaff("operator");
    const id = await createAssignee(client, ranges);
    const stale = (await listAssignees(client))[0].updated_at;
    const first = await client.rpc("admin_update_coverage_assignee", {
      p_id: id,
      p_expected_updated_at: stale,
      p_label: "一人目",
      p_note: "",
      p_ranges: ranges,
    });
    expect(first.error).toBeNull();
    const second = await client.rpc("admin_update_coverage_assignee", {
      p_id: id,
      p_expected_updated_at: stale,
      p_label: "二人目",
      p_note: "",
      p_ranges: ranges,
    });
    expect(second.error?.message).toBe("stale_assignee");
    expect((await listAssignees(client))[0].label).toBe("一人目");
  });

  test("古い updated_at で delete すると stale_assignee", async () => {
    const { client } = await signInStaff("operator");
    const id = await createAssignee(client, ranges);
    const rows = await listAssignees(client);
    const stale = rows[0].updated_at;
    await client.rpc("admin_update_coverage_assignee", {
      p_id: id,
      p_expected_updated_at: stale,
      p_label: "変えた",
      p_note: "",
      p_ranges: ranges,
    });
    const del = await client.rpc("admin_delete_coverage_assignee", {
      p_id: id,
      p_expected_updated_at: stale,
    });
    expect(del.error?.message).toBe("stale_assignee");
    expect(await listAssignees(client)).toHaveLength(1);
  });

  test("消した後の update と delete は assignee_not_found", async () => {
    const { client } = await signInStaff("operator");
    const id = await createAssignee(client, ranges);
    const { updated_at } = (await listAssignees(client))[0];
    await client.rpc("admin_delete_coverage_assignee", {
      p_id: id,
      p_expected_updated_at: updated_at,
    });
    const update = await client.rpc("admin_update_coverage_assignee", {
      p_id: id,
      p_expected_updated_at: updated_at,
      p_label: "a",
      p_note: "",
      p_ranges: ranges,
    });
    expect(update.error?.message).toBe("assignee_not_found");
    const del = await client.rpc("admin_delete_coverage_assignee", {
      p_id: id,
      p_expected_updated_at: updated_at,
    });
    expect(del.error?.message).toBe("assignee_not_found");
  });

  test("update の入力が正しくなければ中身は変わらない", async () => {
    const { client } = await signInStaff("operator");
    const id = await createAssignee(client, ranges);
    const { updated_at } = (await listAssignees(client))[0];
    const bad = await client.rpc("admin_update_coverage_assignee", {
      p_id: id,
      p_expected_updated_at: updated_at,
      p_label: "新しい",
      p_note: "",
      p_ranges: [{ kind: "ward", ward: "北区" }],
    });
    expect(bad.error?.message).toBe("unknown_coverage_place");
    const rows = await listAssignees(client);
    expect(rows[0].label).toBe("田中さん");
    expect(rows[0].updated_at).toBe(updated_at);
    expect(rows[0].ranges).toHaveLength(1);
  });
});

describe("記録とリセット", () => {
  const ranges: Range[] = [{ kind: "ward", ward: "中央区" }];

  beforeEach(async () => {
    await insertBoard("1", "not_yet", "中央区");
  });

  test("記録は id と範囲の数だけ", async () => {
    const { client, email } = await signInStaff("operator");
    const id = await createAssignee(
      client,
      [ranges[0], ranges[0], { kind: "ward", ward: "中央区", school: null }],
      "秘密の呼び名",
      "秘密のメモ",
    );
    const rows = await withPg((db) =>
      db.query<{ actor_email: string; action: string; target: string }>(
        "select actor_email, action, target from private.admin_audit_log order by id desc",
      ),
    );
    expect(rows.rows[0].action).toBe("coverage_assignee_create");
    expect(rows.rows[0].actor_email).toBe(email.toLowerCase());
    expect(rows.rows[0].target).toBe(`${id}（範囲 1）`);
    expect(JSON.stringify(rows.rows)).not.toMatch(/秘密/);
  });

  test("update と delete の記録", async () => {
    await insertBoard("2", "not_yet", "東区");
    const { client } = await signInStaff("operator");
    const id = await createAssignee(client, ranges);
    const { updated_at } = (await listAssignees(client))[0];
    await client.rpc("admin_update_coverage_assignee", {
      p_id: id,
      p_expected_updated_at: updated_at,
      p_label: "x",
      p_note: "",
      p_ranges: [ranges[0], { kind: "ward", ward: "東区" }],
    });
    const after = (await listAssignees(client))[0].updated_at;
    await client.rpc("admin_delete_coverage_assignee", {
      p_id: id,
      p_expected_updated_at: after,
    });
    const rows = await withPg((db) =>
      db.query<{ action: string; target: string }>(
        "select action, target from private.admin_audit_log where action like 'coverage_assignee_%' order by id",
      ),
    );
    expect(rows.rows).toEqual([
      { action: "coverage_assignee_create", target: `${id}（範囲 1）` },
      { action: "coverage_assignee_update", target: `${id}（範囲 2）` },
      { action: "coverage_assignee_delete", target: `${id}（範囲 2）` },
    ]);
  });

  test("リハーサルのリセットで担当者は消えない", async () => {
    const { client: operator } = await signInStaff("operator");
    await createAssignee(operator, ranges);
    const { client: admin } = await signInStaff("admin");
    await setAdminSettings({ rehearsalResetUntil: "now() + interval '1 hour'" });
    const reset = await admin.rpc("admin_reset_rehearsal", { p_confirm: "リセット" });
    expect(reset.error).toBeNull();
    expect(await listAssignees(operator)).toHaveLength(1);
  });
});

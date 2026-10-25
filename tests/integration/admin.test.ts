import {
  resetDatabase,
  setAdminSettings,
  signInAnon,
  signInStaff,
  signInVolunteer,
  withPg,
} from "./helpers";

beforeEach(async () => {
  await resetDatabase();
});

// ---- 判定の土台（一覧・設定・記録） ----------------------------------------

describe("admin_whoami", () => {
  test("一覧の admin は admin", async () => {
    const { client } = await signInStaff("admin");
    expect((await client.rpc("admin_whoami")).data).toBe("admin");
  });

  test("一覧の operator は operator", async () => {
    const { client } = await signInStaff("operator");
    expect((await client.rpc("admin_whoami")).data).toBe("operator");
  });

  test("一覧にない email ユーザーは null", async () => {
    const { client } = await signInStaff(null);
    expect((await client.rpc("admin_whoami")).data).toBe(null);
  });

  test("匿名ユーザーは null", async () => {
    const { client } = await signInAnon();
    expect((await client.rpc("admin_whoami")).data).toBe(null);
  });

  test("ボランティアは null", async () => {
    const { client } = await signInVolunteer("a");
    expect((await client.rpc("admin_whoami")).data).toBe(null);
  });

  test("既定の allowed_amr（oauth だけ）ではパスワードログインは null", async () => {
    const { client } = await signInStaff("admin");
    await setAdminSettings({ allowedAmr: ["oauth"] });
    expect((await client.rpc("admin_whoami")).data).toBe(null);
  });

  test("大文字のメールでも一致する", async () => {
    const { client } = await signInStaff("operator", { email: "Staff-Upper@Example.invalid" });
    expect((await client.rpc("admin_whoami")).data).toBe("operator");
  });

  test("外した人は次の呼び出しから null", async () => {
    const { client, email } = await signInStaff("admin");
    await withPg((db) => db.query("delete from private.admin_members where email = $1", [email]));
    expect((await client.rpc("admin_whoami")).data).toBe(null);
  });
});

describe("admin_recent_audit_log", () => {
  test("一覧にない人は not_admin", async () => {
    const { client } = await signInStaff(null);
    expect((await client.rpc("admin_recent_audit_log")).error?.message).toBe("not_admin");
  });

  test("運営は読める・新しい順・100件まで", async () => {
    const { client } = await signInStaff("operator");
    await withPg((db) =>
      db.query(
        "insert into private.admin_audit_log (actor_email, action, target, created_at) select 'x@example.invalid', 'test', n::text, now() - (n || ' minutes')::interval from generate_series(1, 101) n",
      ),
    );
    const { data, error } = await client.rpc("admin_recent_audit_log");
    expect(error).toBeNull();
    expect(data).toHaveLength(100);
    const times = (data ?? []).map((row) => new Date(row.created_at).getTime());
    expect(times).toEqual([...times].sort((a, b) => b - a));
    expect(data?.[0].target).toBe("1");
  });
});

describe("private の管理テーブル", () => {
  test("anon / authenticated は直接読めない", async () => {
    const { client } = await signInStaff("admin");
    const { error } = await client
      .schema("private" as never)
      .from("admin_members")
      .select();
    expect(error).not.toBeNull();
  });
});

describe("private の関数", () => {
  test("anon / authenticated は実行できない", async () => {
    const rows = await withPg(async (db) => {
      const result = await db.query<{ signature: string; anon: boolean; authenticated: boolean }>(
        `select s as signature,
                has_function_privilege('anon', s, 'execute') as anon,
                has_function_privilege('authenticated', s, 'execute') as authenticated
         from unnest(array[
           'private.admin_role()',
           'private.require_admin_role(text)',
           'private.write_audit(text, text, text)'
         ]) s`,
      );
      return result.rows;
    });
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(row).toMatchObject({ anon: false, authenticated: false });
    }
  });

  test("管理テーブルは権限がなく、RLS が有効", async () => {
    const rows = await withPg(async (db) => {
      const result = await db.query<{ name: string; rls: boolean; granted: boolean }>(
        `select c.relname as name,
                c.relrowsecurity as rls,
                has_table_privilege('authenticated', c.oid, 'select') as granted
         from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'private' and c.relname like 'admin\\_%' and c.relkind = 'r'
         order by c.relname`,
      );
      return result.rows;
    });
    expect(rows.map((row) => row.name)).toEqual([
      "admin_audit_log",
      "admin_members",
      "admin_settings",
    ]);
    for (const row of rows) {
      expect(row).toMatchObject({ rls: true, granted: false });
    }
  });
});

import { createClient } from "@supabase/supabase-js";

// seed.sql が admin_members に登録している、ローカル専用のメールアドレス
const LOCAL_ADMIN_EMAIL = "local-admin@example.invalid";

function loadLocalEnv() {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // .env.local がなければ、環境変数が直接渡されている前提で進める
  }
}

async function main() {
  loadLocalEnv();
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const password = process.env.LOCAL_ADMIN_PASSWORD;
  if (!url || !anonKey) {
    console.error("SUPABASE_URL と SUPABASE_ANON_KEY を設定してください（.env.local）");
    process.exit(1);
  }
  const host = new URL(url).hostname;
  if (host !== "127.0.0.1" && host !== "localhost") {
    console.error(
      "ローカルの Supabase にだけ使えます。SUPABASE_URL が 127.0.0.1 か localhost ではありません",
    );
    process.exit(1);
  }
  if (!password || password.length < 8) {
    console.error("LOCAL_ADMIN_PASSWORD に 8 文字以上の値を指定してください");
    process.exit(1);
  }

  const supabase = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data, error } = await supabase.auth.signUp({ email: LOCAL_ADMIN_EMAIL, password });
  if (error?.code === "user_already_exists") {
    console.log(`${LOCAL_ADMIN_EMAIL} は作成済みです`);
    return;
  }
  if (error) {
    console.error(`作成できませんでした: ${error.message}`);
    process.exit(1);
  }
  // 確認メールが有効な設定では、登録済みでもエラーにせず identities が空のユーザーが返る
  if (data.user && (data.user.identities?.length ?? 0) === 0) {
    console.log(`${LOCAL_ADMIN_EMAIL} は作成済みです`);
    return;
  }
  console.log(`${LOCAL_ADMIN_EMAIL} を作成しました`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

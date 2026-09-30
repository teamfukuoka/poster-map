// proxy（Node ランタイム）からも読むため server-only は付けない。キーは anon のみで、秘密ではない。
export type SupabaseEnv = { url: string; anonKey: string };

export function supabaseEnv(env: NodeJS.ProcessEnv = process.env): SupabaseEnv {
  const url = env.SUPABASE_URL;
  const anonKey = env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("SUPABASE_URL と SUPABASE_ANON_KEY を設定してください（.env.example 参照）");
  }
  return { url, anonKey };
}

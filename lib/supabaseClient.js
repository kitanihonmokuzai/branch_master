import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // eslint-disable-next-line no-console
  console.warn(
    "Supabaseの環境変数が設定されていません。Vercelの Environment Variables、" +
      "またはローカルの .env.local を確認してください。"
  );
}

// 環境変数が未設定でもビルド自体は落ちないよう、ダミー値にフォールバックする。
// 実行時にSupabaseへのアクセスが発生した時点でエラーになる。
export const supabase = createClient(
  url || "https://placeholder.supabase.co",
  anonKey || "placeholder-anon-key"
);

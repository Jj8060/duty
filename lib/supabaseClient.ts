import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // 在开发阶段提示缺少配置，方便排查
  // 生产环境下请确保已正确配置环境变量
  // eslint-disable-next-line no-console
  console.warn(
    "[Supabase] NEXT_PUBLIC_SUPABASE_URL 或 NEXT_PUBLIC_SUPABASE_ANON_KEY 未配置。"
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


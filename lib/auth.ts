import { supabase } from "./supabaseClient";

export interface AdminUser {
  username: string;
  isRoot: boolean;
}

export async function verifyAdmin(
  username: string,
  password: string
): Promise<AdminUser | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  const { data, error } = await supabase
    .from("admins")
    .select("username, is_root")
    .eq("username", username)
    .eq("password", password)
    .eq("is_disabled", false)
    .maybeSingle();

  if (error || !data) return null;
  return {
    username: data.username,
    isRoot: Boolean(data.is_root)
  };
}

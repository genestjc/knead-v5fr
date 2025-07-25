import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // Use service role key for server-side
);

export async function upsertPaidUser(
  wallet: string,
  email: string,
) {
  const { data, error } = await supabase
    .from("paid_users")
    .upsert([{ wallet: wallet.toLowerCase(), email }], {
      onConflict: "wallet",
    });
  if (error) throw error;
  return data;
}

export async function getUserByWallet(wallet: string) {
  const { data, error } = await supabase
    .from("paid_users")
    .select("*")
    .eq("wallet", wallet.toLowerCase())
    .single();
  if (error) return null;
  return data;
}

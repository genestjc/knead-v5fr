import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!,
);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") return res.status(405).end();
  const { user_address, checkOnly } = req.body;
  if (!user_address)
    return res
      .status(400)
      .json({ error: "Missing user_address" });

  const { count } = await supabase
    .from("article_reads")
    .select("*", { count: "exact", head: true })
    .eq("user_address", user_address)
    .gte(
      "read_at",
      new Date(
        Date.now() - 30 * 24 * 60 * 60 * 1000,
      ).toISOString(),
    );

  const safeCount = count ?? 0;

  if (checkOnly) {
    return res.status(200).json({ reads: safeCount });
  }

  if (safeCount >= 3) {
    return res
      .status(403)
      .json({
        error: "Freemium limit reached",
        reads: safeCount,
      });
  }

  await supabase
    .from("article_reads")
    .insert([
      { user_address, read_at: new Date().toISOString() },
    ]);
  res
    .status(200)
    .json({ success: true, reads: safeCount + 1 });
}

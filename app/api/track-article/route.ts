import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!,
);

export async function POST(req: NextRequest) {
  const { user_address, checkOnly } = await req.json();
  if (!user_address) {
    return NextResponse.json(
      { error: "Missing user_address" },
      { status: 400 },
    );
  }

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
    return NextResponse.json({ reads: safeCount });
  }

  if (safeCount >= 3) {
    return NextResponse.json(
      { error: "Freemium limit reached", reads: safeCount },
      { status: 403 },
    );
  }

  await supabase
    .from("article_reads")
    .insert([
      { user_address, read_at: new Date().toISOString() },
    ]);
  return NextResponse.json({
    success: true,
    reads: safeCount + 1,
  });
}

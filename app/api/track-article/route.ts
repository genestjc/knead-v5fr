import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: NextRequest) {
  try {
    const { user_address, story_slug, checkOnly } = await req.json();
    
    if (!user_address) {
      return NextResponse.json(
        { error: "Missing user_address" },
        { status: 400 },
      );
    }

    // Current date minus 30 days - used for monthly limit
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Count articles read in the last 30 days
    const { count, error } = await supabase
      .from("article_reads")
      .select("*", { count: "exact", head: true })
      .eq("user_address", user_address.toLowerCase())
      .gte("read_at", thirtyDaysAgo.toISOString());

    if (error) {
      console.error("Error fetching article reads:", error);
      return NextResponse.json(
        { error: "Failed to check article reads" },
        { status: 500 },
      );
    }

    const safeCount = count ?? 0;

    // If just checking count, return it
    if (checkOnly) {
      return NextResponse.json({ reads: safeCount });
    }

    // Check if user has reached their limit
    if (safeCount >= 3) {
      return NextResponse.json(
        { error: "Freemium limit reached", reads: safeCount },
        { status: 403 },
      );
    }

    // Record this article view
    const { error: insertError } = await supabase
      .from("article_reads")
      .insert([
        { 
          user_address: user_address.toLowerCase(), 
          read_at: new Date().toISOString(),
          article_slug: story_slug || "unknown" // Track which article was read
        },
      ]);

    if (insertError) {
      console.error("Error recording article read:", insertError);
      return NextResponse.json(
        { error: "Failed to record article view" },
        { status: 500 },
      );
    }

    // Return updated count
    return NextResponse.json({
      success: true,
      reads: safeCount + 1,
    });
  } catch (error) {
    console.error("Error in track-article:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 },
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: NextRequest) {
  try {
    const { user_address, story_slug, checkOnly } = await req.json();
    
    if (!user_address || !story_slug) {
      return NextResponse.json(
        { error: "Missing user_address or story_slug" },
        { status: 400 },
      );
    }

    // Current date minus 30 days - used for monthly limit
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // First check if this specific article was already read
    const { data: existingRead } = await supabase
      .from("article_reads")
      .select("*")
      .eq("user_address", user_address.toLowerCase())
      .eq("article_slug", story_slug)
      .gte("read_at", thirtyDaysAgo.toISOString())
      .single();

    // If already read, don't count it again
    if (existingRead) {
      // Count unique articles read in the last 30 days
      const { count: uniqueCount, error: countError } = await supabase
        .from("article_reads")
        .select("article_slug", { count: "exact", head: false })
        .eq("user_address", user_address.toLowerCase())
        .gte("read_at", thirtyDaysAgo.toISOString())
        .limit(1000);

      if (countError) {
        console.error("Error fetching article reads:", countError);
        return NextResponse.json(
          { error: "Failed to check article reads" },
          { status: 500 },
        );
      }

      return NextResponse.json({ 
        reads: uniqueCount || 0,
        alreadyRead: true 
      });
    }

    // Count unique articles read in the last 30 days
    const { data: uniqueArticles, error } = await supabase
      .from("article_reads")
      .select("article_slug")
      .eq("user_address", user_address.toLowerCase())
      .gte("read_at", thirtyDaysAgo.toISOString());

    if (error) {
      console.error("Error fetching article reads:", error);
      return NextResponse.json(
        { error: "Failed to check article reads" },
        { status: 500 },
      );
    }

    // Get unique article count (using Set to ensure uniqueness)
    const uniqueArticleSet = new Set(uniqueArticles.map(item => item.article_slug));
    const uniqueCount = uniqueArticleSet.size;

    // If just checking count, return it
    if (checkOnly) {
      return NextResponse.json({ reads: uniqueCount });
    }

    // Check if user has reached their limit
    if (uniqueCount >= 3) {
      return NextResponse.json(
        { error: "Freemium limit reached", reads: uniqueCount },
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
          article_slug: story_slug
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
      reads: uniqueCount + 1,
    });
  } catch (error) {
    console.error("Error in track-article:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 },
    );
  }
}

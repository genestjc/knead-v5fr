import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: NextRequest) {
  try {
    console.log("Track article API called");
    const { user_address, story_slug, checkOnly } = await req.json();
    
    if (!user_address || !story_slug) {
      console.log("Missing required fields");
      return NextResponse.json(
        { error: "Missing user_address or story_slug" },
        { status: 400 },
      );
    }

    console.log(`Processing article tracking for user ${user_address} and story ${story_slug}`);

    // Current date minus 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoISO = thirtyDaysAgo.toISOString();

    // Check table structure first
    const { data: tableInfo, error: tableError } = await supabase
      .from('article_reads')
      .select('*')
      .limit(1);

    if (tableError) {
      console.error("Error checking article_reads table:", tableError);
      return NextResponse.json(
        { error: "Database setup issue" },
        { status: 500 },
      );
    }

    // First check if article was already read
    const { data: existingRead, error: readError } = await supabase
      .from("article_reads")
      .select()
      .eq("user_address", user_address.toLowerCase())
      .eq("article_slug", story_slug)
      .gte("read_at", thirtyDaysAgoISO);

    if (readError) {
      console.error("Error checking existing read:", readError);
      return NextResponse.json(
        { error: "Failed to check existing read" },
        { status: 500 },
      );
    }

    // Already read this article
    if (existingRead && existingRead.length > 0) {
      console.log("Article already read by user");
      
      // Get all unique articles read in past 30 days
      const { data: allReads, error: countError } = await supabase
        .from("article_reads")
        .select("article_slug")
        .eq("user_address", user_address.toLowerCase())
        .gte("read_at", thirtyDaysAgoISO);

      if (countError) {
        console.error("Error counting article reads:", countError);
        return NextResponse.json(
          { error: "Failed to count reads" },
          { status: 500 },
        );
      }

      // Count unique articles
      const uniqueSlugs = [...new Set(allReads?.map(item => item.article_slug))];
      
      return NextResponse.json({
        reads: uniqueSlugs.length,
        alreadyRead: true
      });
    }

    // Count articles read in last 30 days
    const { data: allArticles, error: countError } = await supabase
      .from("article_reads")
      .select("article_slug")
      .eq("user_address", user_address.toLowerCase())
      .gte("read_at", thirtyDaysAgoISO);

    if (countError) {
      console.error("Error counting articles:", countError);
      return NextResponse.json(
        { error: "Failed to count articles" },
        { status: 500 },
      );
    }

    // Count unique articles
    const uniqueArticles = [...new Set(allArticles?.map(item => item.article_slug) || [])];
    const articleCount = uniqueArticles.length;

    // If just checking, return the count
    if (checkOnly) {
      console.log(`Check only - user has read ${articleCount} articles`);
      return NextResponse.json({ reads: articleCount });
    }

    // Check if limit reached
    if (articleCount >= 3) {
      console.log("User has reached article limit");
      return NextResponse.json(
        { error: "Freemium limit reached", reads: articleCount },
        { status: 403 },
      );
    }

    // Record the read
    console.log("Recording new article read");
    const { error: insertError } = await supabase
      .from("article_reads")
      .insert([
        {
          user_address: user_address.toLowerCase(),
          article_slug: story_slug,
          read_at: new Date().toISOString(),
        },
      ]);

    if (insertError) {
      console.error("Error inserting article read:", insertError);
      return NextResponse.json(
        { error: "Failed to record article view" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      reads: articleCount + 1,
    });
    
  } catch (error) {
    console.error("Unexpected error in track-article:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 },
    );
  }
}

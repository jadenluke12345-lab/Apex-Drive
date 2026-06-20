import { NextResponse } from "next/server";
import {
  routeSubmissionRecordToView,
  type RouteSubmissionRecord,
} from "@/lib/route-submissions";
import { requireSiteAdminUserId } from "@/lib/admin-server";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function supabaseUnavailableResponse() {
  return NextResponse.json(
    { error: "Supabase is not configured for moderation." },
    { status: 503 }
  );
}

export async function GET() {
  try {
    if (!isSupabaseConfigured()) {
      return supabaseUnavailableResponse();
    }

    await requireSiteAdminUserId();

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("route_submissions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) throw error;

    const submissions = (data ?? []).map((row) =>
      routeSubmissionRecordToView(row as RouteSubmissionRecord)
    );
    const pendingCount = submissions.filter(
      (submission) => submission.status === "pending"
    ).length;

    return NextResponse.json({ submissions, pendingCount });
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Admin moderation fetch failed", error);
    return NextResponse.json(
      { error: "Could not load moderation queue." },
      { status: 500 }
    );
  }
}

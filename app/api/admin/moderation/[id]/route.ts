import { NextResponse } from "next/server";
import {
  routeSubmissionRecordToView,
  type RouteSubmissionRecord,
  type RouteSubmissionStatus,
} from "@/lib/route-submissions";
import { requireSiteAdminUserId } from "@/lib/admin-server";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = {
  params: Promise<{ id: string }>;
};

function supabaseUnavailableResponse() {
  return NextResponse.json(
    { error: "Supabase is not configured for moderation." },
    { status: 503 }
  );
}

function normalizeAction(value: unknown): "approve" | "reject" | null {
  if (value === "approve" || value === "reject") return value;
  return null;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    if (!isSupabaseConfigured()) {
      return supabaseUnavailableResponse();
    }

    const adminUserId = await requireSiteAdminUserId();
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as { action?: string };
    const action = normalizeAction(body.action);

    if (!action) {
      return NextResponse.json(
        { error: 'Action must be "approve" or "reject".' },
        { status: 400 }
      );
    }

    const nextStatus: RouteSubmissionStatus =
      action === "approve" ? "approved" : "rejected";

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("route_submissions")
      .update({
        status: nextStatus,
        reviewed_by: adminUserId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: "Submission not found." }, { status: 404 });
    }

    return NextResponse.json({
      submission: routeSubmissionRecordToView(data as RouteSubmissionRecord),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Admin moderation update failed", error);
    return NextResponse.json(
      { error: "Could not update submission." },
      { status: 500 }
    );
  }
}

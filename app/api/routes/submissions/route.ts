import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import {
  routeSubmissionPayloadToRow,
  routeSubmissionRecordToView,
  type RouteSubmissionRecord,
} from "@/lib/route-submissions";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function supabaseUnavailableResponse() {
  return NextResponse.json(
    { error: "Supabase is not configured for route submissions." },
    { status: 503 }
  );
}

export async function GET() {
  try {
    if (!isSupabaseConfigured()) {
      return supabaseUnavailableResponse();
    }

    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const { data: approvedRows, error: approvedError } = await supabase
      .from("route_submissions")
      .select("*")
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(100);

    if (approvedError) throw approvedError;

    const { data: ownRows, error: ownError } = await supabase
      .from("route_submissions")
      .select("*")
      .eq("clerk_user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (ownError) throw ownError;

    const merged = new Map<string, RouteSubmissionRecord>();
    for (const row of [...(approvedRows ?? []), ...(ownRows ?? [])]) {
      merged.set(row.id, row as RouteSubmissionRecord);
    }

    const submissions = Array.from(merged.values())
      .sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at))
      .map((record) => ({
        ...routeSubmissionRecordToView(record),
        isOwn: record.clerk_user_id === userId,
      }));

    return NextResponse.json({ submissions });
  } catch (error) {
    console.error("Route submissions fetch failed", error);
    return NextResponse.json(
      { error: "Could not load route submissions." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    if (!isSupabaseConfigured()) {
      return supabaseUnavailableResponse();
    }

    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      name?: string;
      startLabel?: string;
      endLabel?: string;
      notes?: string;
    };

    const name = body.name?.trim() ?? "";
    const startLabel = body.startLabel?.trim() ?? "";
    const endLabel = body.endLabel?.trim() ?? "";
    const notes = body.notes?.trim() ?? "";

    if (!name || !startLabel || !endLabel) {
      return NextResponse.json(
        { error: "Route name, start point, and end point are required." },
        { status: 400 }
      );
    }

    const submitterName =
      user.fullName?.trim() ||
      [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
      "Driver";
    const submitterEmail = user.primaryEmailAddress?.emailAddress ?? "";

    const supabase = getSupabaseAdmin();
    const row = routeSubmissionPayloadToRow({
      clerkUserId: userId,
      submitterName,
      submitterEmail,
      payload: { name, startLabel, endLabel, notes },
    });

    const { data, error } = await supabase
      .from("route_submissions")
      .insert({ ...row, status: "pending" })
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json({
      submission: routeSubmissionRecordToView(data as RouteSubmissionRecord),
    });
  } catch (error) {
    console.error("Route submission create failed", error);
    return NextResponse.json(
      { error: "Could not submit route for approval." },
      { status: 500 }
    );
  }
}

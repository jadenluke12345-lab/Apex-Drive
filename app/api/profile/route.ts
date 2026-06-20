import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import {
  formToProfilePayload,
  profilePayloadToRow,
  profileRecordToForm,
  type ProfilePayload,
  type ProfileRecord,
} from "@/lib/profile";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function supabaseUnavailableResponse() {
  return NextResponse.json(
    { error: "Supabase is not configured for profile persistence." },
    { status: 503 }
  );
}

function defaultPayloadFromClerkUser(
  user: NonNullable<Awaited<ReturnType<typeof currentUser>>>
): ProfilePayload {
  const fullName =
    user.fullName?.trim() ||
    [user.firstName, user.lastName].filter(Boolean).join(" ").trim();

  return {
    displayName: fullName,
    email: user.primaryEmailAddress?.emailAddress ?? "",
    phone: user.phoneNumbers[0]?.phoneNumber ?? "",
    city: "",
    bio: "",
    preferredUnits: "imperial",
    receiveFriendRequests: true,
    receiveConvoyUpdates: true,
    tier: "free",
    avatarUrl: user.imageUrl ?? null,
  };
}

async function fetchProfile(clerkUserId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("clerk_user_id", clerkUserId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as ProfileRecord | null;
}

async function upsertProfile(clerkUserId: string, payload: ProfilePayload) {
  const supabase = getSupabaseAdmin();
  const row = profilePayloadToRow(clerkUserId, payload);
  const { data, error } = await supabase
    .from("profiles")
    .upsert(row, { onConflict: "clerk_user_id" })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as ProfileRecord;
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

    let profile = await fetchProfile(userId);
    if (!profile) {
      const user = await currentUser();
      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      profile = await upsertProfile(userId, defaultPayloadFromClerkUser(user));
    }

    return NextResponse.json({
      profile: profileRecordToForm(profile),
      avatarUrl: profile.avatar_url,
      updatedAt: profile.updated_at,
    });
  } catch (error) {
    console.error("Profile fetch failed", error);
    return NextResponse.json({ error: "Could not load profile." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    if (!isSupabaseConfigured()) {
      return supabaseUnavailableResponse();
    }

    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as Partial<ProfilePayload>;
    const existing = await fetchProfile(userId);
    const user = await currentUser();

    const payload: ProfilePayload = {
      displayName:
        typeof body.displayName === "string"
          ? body.displayName
          : existing?.display_name ?? user?.fullName ?? "",
      email:
        typeof body.email === "string"
          ? body.email
          : existing?.email ?? user?.primaryEmailAddress?.emailAddress ?? "",
      phone:
        typeof body.phone === "string"
          ? body.phone
          : existing?.phone ?? user?.phoneNumbers[0]?.phoneNumber ?? "",
      city:
        typeof body.city === "string" ? body.city : existing?.city ?? "",
      bio: typeof body.bio === "string" ? body.bio : existing?.bio ?? "",
      preferredUnits:
        typeof body.preferredUnits === "string"
          ? body.preferredUnits
          : existing?.preferred_units ?? "imperial",
      receiveFriendRequests:
        typeof body.receiveFriendRequests === "boolean"
          ? body.receiveFriendRequests
          : (existing?.receive_friend_requests ?? true),
      receiveConvoyUpdates:
        typeof body.receiveConvoyUpdates === "boolean"
          ? body.receiveConvoyUpdates
          : (existing?.receive_convoy_updates ?? true),
      tier:
        body.tier === "interceptor" || body.tier === "commander" || body.tier === "free"
          ? body.tier
          : (existing?.subscription_tier ?? "free"),
      avatarUrl:
        typeof body.avatarUrl === "string"
          ? body.avatarUrl
          : body.avatarUrl === null
            ? null
            : (existing?.avatar_url ?? user?.imageUrl ?? null),
    };

    const profile = await upsertProfile(userId, payload);

    return NextResponse.json({
      profile: profileRecordToForm(profile),
      avatarUrl: profile.avatar_url,
      updatedAt: profile.updated_at,
    });
  } catch (error) {
    console.error("Profile save failed", error);
    return NextResponse.json({ error: "Could not save profile." }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { auth, clerkClient, currentUser } from "@clerk/nextjs/server";
import Stripe from "stripe";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, {
      apiVersion: "2026-05-27.dahlia",
    })
  : null;

function readSubscriptionIds(user: Awaited<ReturnType<typeof currentUser>>) {
  const subscriptionMeta = user?.publicMetadata?.subscription;
  if (!subscriptionMeta || typeof subscriptionMeta !== "object") {
    return { stripeCustomerId: null, stripeSubscriptionId: null };
  }

  const record = subscriptionMeta as Record<string, unknown>;
  return {
    stripeCustomerId:
      typeof record.stripeCustomerId === "string" ? record.stripeCustomerId : null,
    stripeSubscriptionId:
      typeof record.stripeSubscriptionId === "string"
        ? record.stripeSubscriptionId
        : null,
  };
}

export async function POST() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await currentUser();
    const { stripeCustomerId, stripeSubscriptionId } = readSubscriptionIds(user);

    if (stripe && stripeSubscriptionId) {
      try {
        await stripe.subscriptions.cancel(stripeSubscriptionId);
      } catch (error) {
        console.error("Stripe subscription cancel failed during account deletion", error);
      }
    }

    if (stripe && stripeCustomerId) {
      try {
        await stripe.customers.del(stripeCustomerId);
      } catch (error) {
        console.error("Stripe customer delete failed during account deletion", error);
      }
    }

    if (isSupabaseConfigured()) {
      try {
        const supabase = getSupabaseAdmin();
        await supabase.from("profiles").delete().eq("clerk_user_id", userId);
      } catch (error) {
        console.error("Supabase profile delete failed during account deletion", error);
      }
    }

    const client = await clerkClient();
    await client.users.deleteUser(userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Account deletion failed", error);
    return NextResponse.json({ error: "Could not delete account." }, { status: 500 });
  }
}

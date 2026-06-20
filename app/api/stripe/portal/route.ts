import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, {
      apiVersion: "2026-05-27.dahlia",
    })
  : null;

function readStripeCustomerId(user: Awaited<ReturnType<typeof currentUser>>) {
  const subscriptionMeta = user?.publicMetadata?.subscription;
  if (!subscriptionMeta || typeof subscriptionMeta !== "object") return null;
  const customerId = (subscriptionMeta as Record<string, unknown>).stripeCustomerId;
  return typeof customerId === "string" && customerId.length > 0 ? customerId : null;
}

export async function POST(request: Request) {
  try {
    if (!stripe) {
      return NextResponse.json(
        { error: "Stripe is not configured. Set STRIPE_SECRET_KEY first." },
        { status: 500 }
      );
    }

    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await currentUser();
    const stripeCustomerId = readStripeCustomerId(user);
    if (!stripeCustomerId) {
      return NextResponse.json(
        { error: "No Stripe billing profile found for this account yet." },
        { status: 400 }
      );
    }

    const origin = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${origin}/`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Stripe billing portal creation failed", error);
    return NextResponse.json(
      { error: "Could not open billing portal." },
      { status: 500 }
    );
  }
}

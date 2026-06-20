import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PLAN_CATALOG = {
  starter: {
    id: "starter",
    label: "Digital Garage",
    amount: 0,
    interval: "month",
    priceId: process.env.STRIPE_PRICE_STARTER,
  },
  pro: {
    id: "pro",
    label: "Apex Interceptor",
    amount: 799,
    interval: "month",
    priceId: process.env.STRIPE_PRICE_PRO,
  },
  elite: {
    id: "elite",
    label: "Convoy Commander",
    amount: 4999,
    interval: "year",
    priceId: process.env.STRIPE_PRICE_ELITE,
  },
} as const;

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, {
      apiVersion: "2026-05-27.dahlia",
    })
  : null;

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
    const payload = (await request.json().catch(() => ({}))) as { plan?: string };
    const requestedPlan = payload.plan?.toLowerCase() ?? "starter";
    const plan =
      PLAN_CATALOG[requestedPlan as keyof typeof PLAN_CATALOG] ?? PLAN_CATALOG.starter;

    const subscriptionMeta = user?.publicMetadata?.subscription;
    const existingCustomerId =
      subscriptionMeta &&
      typeof subscriptionMeta === "object" &&
      typeof (subscriptionMeta as Record<string, unknown>).stripeCustomerId === "string"
        ? ((subscriptionMeta as Record<string, unknown>).stripeCustomerId as string)
        : undefined;

    const origin = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
    const lineItem: Stripe.Checkout.SessionCreateParams.LineItem = plan.priceId
      ? {
          quantity: 1,
          price: plan.priceId,
        }
      : {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: plan.amount,
            recurring: { interval: plan.interval },
            product_data: {
              name: `Apex Drive ${plan.label}`,
              description: "Apex Drive premium subscription",
            },
          },
        };

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      client_reference_id: userId,
      ...(existingCustomerId
        ? { customer: existingCustomerId }
        : {
            customer_email: user?.primaryEmailAddress?.emailAddress ?? undefined,
          }),
      allow_promotion_codes: true,
      metadata: {
        clerkUserId: userId,
        plan: plan.id,
      },
      subscription_data: {
        metadata: {
          clerkUserId: userId,
          plan: plan.id,
        },
      },
      line_items: [lineItem],
      success_url: `${origin}/?subscription=success`,
      cancel_url: `${origin}/?subscription=cancelled`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Stripe checkout creation failed", error);
    return NextResponse.json(
      { error: "Could not start checkout session." },
      { status: 500 }
    );
  }
}

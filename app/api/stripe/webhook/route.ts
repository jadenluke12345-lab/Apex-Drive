import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { clerkClient } from "@clerk/nextjs/server";
import Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, {
      apiVersion: "2026-05-27.dahlia",
    })
  : null;

const ACTIVE_STATUSES = new Set(["active", "trialing"]);

function inferPlanFromAmount(unitAmount: number | null | undefined) {
  if (unitAmount === 4999) return "elite";
  if (unitAmount === 799) return "pro";
  return "starter";
}

async function persistSubscriptionMetadata(input: {
  clerkUserId: string;
  plan: string;
  status: string;
  active: boolean;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  currentPeriodEnd?: number;
}) {
  const client = await clerkClient();
  await client.users.updateUserMetadata(input.clerkUserId, {
    publicMetadata: {
      subscription: {
        plan: input.plan,
        status: input.status,
        active: input.active,
        stripeCustomerId: input.stripeCustomerId ?? null,
        stripeSubscriptionId: input.stripeSubscriptionId ?? null,
        currentPeriodEnd:
          typeof input.currentPeriodEnd === "number"
            ? new Date(input.currentPeriodEnd * 1000).toISOString()
            : null,
        updatedAt: new Date().toISOString(),
      },
    },
  });
}

export async function POST(request: Request) {
  if (!stripe || !stripeWebhookSecret) {
    return NextResponse.json(
      { error: "Stripe webhook is not configured." },
      { status: 500 }
    );
  }

  const signature = (await headers()).get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe signature." }, { status: 400 });
  }

  const payload = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, stripeWebhookSecret);
  } catch (error) {
    console.error("Invalid stripe webhook signature", error);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const clerkUserId =
        session.metadata?.clerkUserId ??
        (typeof session.client_reference_id === "string"
          ? session.client_reference_id
          : undefined);
      if (!clerkUserId) break;

      await persistSubscriptionMetadata({
        clerkUserId,
        plan: session.metadata?.plan ?? "starter",
        status: "checkout_completed",
        active: true,
        stripeCustomerId: typeof session.customer === "string" ? session.customer : undefined,
        stripeSubscriptionId:
          typeof session.subscription === "string" ? session.subscription : undefined,
      });
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const clerkUserId = subscription.metadata?.clerkUserId;
      if (!clerkUserId) break;

      const rawPeriodEnd = (subscription as unknown as Record<string, unknown>).current_period_end;
      const currentPeriodEnd =
        typeof rawPeriodEnd === "number" ? rawPeriodEnd : undefined;
      const unitAmount = subscription.items.data[0]?.price?.unit_amount;
      const plan =
        subscription.metadata?.plan || inferPlanFromAmount(unitAmount);
      const status = event.type === "customer.subscription.deleted"
        ? "canceled"
        : subscription.status;

      await persistSubscriptionMetadata({
        clerkUserId,
        plan,
        status,
        active: ACTIVE_STATUSES.has(status),
        stripeCustomerId:
          typeof subscription.customer === "string"
            ? subscription.customer
            : undefined,
        stripeSubscriptionId: subscription.id,
        currentPeriodEnd,
      });
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}

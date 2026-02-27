import { Hono } from "hono";
import Stripe from "stripe";
import { prisma } from "../prisma";
import { getSupabaseUserId } from "../supabase-auth";
import { env } from "../env";

const billingRouter = new Hono();

// Lazy-initialize Stripe so the app starts even without keys configured
function getStripe(): Stripe {
  if (!env.STRIPE_SECRET_KEY || env.STRIPE_SECRET_KEY.includes("placeholder")) {
    throw new Error("Stripe is not configured. Add STRIPE_SECRET_KEY to your environment variables.");
  }
  return new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: "2026-01-28.clover" });
}

// Map plan+cycle to Stripe price ID from env
function getPriceId(plan: string, cycle: string): string | null {
  if (plan === "pro" && cycle === "monthly") return env.STRIPE_PRICE_PRO_MONTHLY || null;
  if (plan === "pro" && cycle === "annual") return env.STRIPE_PRICE_PRO_ANNUAL || null;
  if (plan === "dealer" && cycle === "monthly") return env.STRIPE_PRICE_DEALER_MONTHLY || null;
  if (plan === "dealer" && cycle === "annual") return env.STRIPE_PRICE_DEALER_ANNUAL || null;
  return null;
}

// Map Stripe price ID back to plan name
function planFromPriceId(priceId: string): { plan: string; cycle: string } {
  if (priceId === env.STRIPE_PRICE_PRO_MONTHLY) return { plan: "pro", cycle: "monthly" };
  if (priceId === env.STRIPE_PRICE_PRO_ANNUAL) return { plan: "pro", cycle: "annual" };
  if (priceId === env.STRIPE_PRICE_DEALER_MONTHLY) return { plan: "dealer", cycle: "monthly" };
  if (priceId === env.STRIPE_PRICE_DEALER_ANNUAL) return { plan: "dealer", cycle: "annual" };
  return { plan: "starter", cycle: "monthly" };
}

// ── GET /api/billing/subscription ─────────────────────────────────────────────
// Returns the current user's subscription status
billingRouter.get("/subscription", async (c) => {
  const userId = getSupabaseUserId(c);
  if (!userId || userId === "default") return c.json({ error: { message: "Unauthorized" } }, 401);

  const sub = await prisma.subscription.findUnique({
    where: { userId },
  });

  // Return a default starter plan if no subscription record exists
  if (!sub) {
    return c.json({
      data: {
        plan: "starter",
        billingCycle: "monthly",
        status: "active",
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      },
    });
  }

  return c.json({ data: sub });
});

// ── POST /api/billing/checkout ─────────────────────────────────────────────────
// Creates a Stripe Checkout Session and returns the URL
billingRouter.post("/checkout", async (c) => {
  const userId = getSupabaseUserId(c);
  if (!userId || userId === "default") return c.json({ error: { message: "Unauthorized" } }, 401);

  let stripe: Stripe;
  try {
    stripe = getStripe();
  } catch (e: any) {
    return c.json({ error: { message: e.message, code: "STRIPE_NOT_CONFIGURED" } }, 503);
  }

  const body = await c.req.json<{ plan: string; cycle: string; successUrl: string; cancelUrl: string }>();
  const { plan, cycle, successUrl, cancelUrl } = body;

  if (!plan || !cycle) {
    return c.json({ error: { message: "plan and cycle are required" } }, 400);
  }

  const priceId = getPriceId(plan, cycle);
  if (!priceId || priceId.includes("placeholder")) {
    return c.json({
      error: {
        message: "This plan is not yet configured. Add the Stripe price IDs to your environment variables.",
        code: "PRICE_NOT_CONFIGURED",
      },
    }, 503);
  }

  // Get or create Stripe customer
  let sub = await prisma.subscription.findUnique({ where: { userId } });
  let customerId = sub?.stripeCustomerId;

  if (!customerId) {
    const customer = await stripe.customers.create({
      metadata: { userId },
    });
    customerId = customer.id;

    // Upsert subscription record with customer ID
    sub = await prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        stripeCustomerId: customerId,
        plan: "starter",
        status: "inactive",
      },
      update: { stripeCustomerId: customerId },
    });
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ["card"],
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl || `${env.BACKEND_URL?.replace(":3000", ":8000") || "http://localhost:8000"}/?checkout=success`,
    cancel_url: cancelUrl || `${env.BACKEND_URL?.replace(":3000", ":8000") || "http://localhost:8000"}/?checkout=canceled`,
    subscription_data: {
      metadata: { userId, plan, cycle },
    },
    allow_promotion_codes: true,
  });

  return c.json({ data: { url: session.url, sessionId: session.id } });
});

// ── POST /api/billing/portal ───────────────────────────────────────────────────
// Creates a Stripe Customer Portal session (manage billing, cancel, update card)
billingRouter.post("/portal", async (c) => {
  const userId = getSupabaseUserId(c);
  if (!userId || userId === "default") return c.json({ error: { message: "Unauthorized" } }, 401);

  let stripe: Stripe;
  try {
    stripe = getStripe();
  } catch (e: any) {
    return c.json({ error: { message: e.message, code: "STRIPE_NOT_CONFIGURED" } }, 503);
  }

  const sub = await prisma.subscription.findUnique({ where: { userId } });
  if (!sub?.stripeCustomerId) {
    return c.json({ error: { message: "No billing account found" } }, 404);
  }

  const body = await c.req.json<{ returnUrl?: string }>().catch(() => ({ returnUrl: undefined }));
  const returnUrl = body?.returnUrl || `${env.BACKEND_URL?.replace(":3000", ":8000") || "http://localhost:8000"}/`;

  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripeCustomerId,
    return_url: returnUrl,
  });

  return c.json({ data: { url: session.url } });
});

// ── POST /api/billing/webhook ──────────────────────────────────────────────────
// Stripe webhook — handles subscription lifecycle events
billingRouter.post("/webhook", async (c) => {
  let stripe: Stripe;
  try {
    stripe = getStripe();
  } catch {
    return c.json({ error: { message: "Stripe not configured" } }, 503);
  }

  const sig = c.req.header("stripe-signature");
  const webhookSecret = env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret || webhookSecret.includes("placeholder")) {
    return c.json({ error: { message: "Webhook secret not configured" } }, 503);
  }

  let event: Stripe.Event;
  const rawBody = await c.req.text();

  try {
    event = stripe.webhooks.constructEvent(rawBody, sig!, webhookSecret);
  } catch (err: any) {
    console.error("[Stripe Webhook] Signature verification failed:", err.message);
    return c.json({ error: { message: "Invalid signature" } }, 400);
  }

  console.log("[Stripe Webhook]", event.type);

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== "subscription") break;

      const subscription = await stripe.subscriptions.retrieve(session.subscription as string) as any;
      const priceId = subscription.items.data[0]?.price.id || "";
      const { plan, cycle } = planFromPriceId(priceId);
      const userId = subscription.metadata?.userId || (session as any).metadata?.userId;

      if (!userId) {
        console.error("[Stripe Webhook] No userId in metadata");
        break;
      }

      await prisma.subscription.upsert({
        where: { userId },
        create: {
          userId,
          stripeCustomerId: session.customer as string,
          stripeSubscriptionId: subscription.id,
          stripePriceId: priceId,
          plan,
          billingCycle: cycle,
          status: "active",
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
        },
        update: {
          stripeCustomerId: session.customer as string,
          stripeSubscriptionId: subscription.id,
          stripePriceId: priceId,
          plan,
          billingCycle: cycle,
          status: "active",
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
        },
      });

      console.log(`[Stripe Webhook] Subscription activated: ${plan} (${cycle}) for user ${userId}`);
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as any;
      const priceId = subscription.items.data[0]?.price.id || "";
      const { plan, cycle } = planFromPriceId(priceId);

      const sub = await prisma.subscription.findFirst({
        where: { stripeSubscriptionId: subscription.id },
      });
      if (!sub) break;

      await prisma.subscription.update({
        where: { id: sub.id },
        data: {
          stripePriceId: priceId,
          plan,
          billingCycle: cycle,
          status: subscription.status === "active" ? "active" : subscription.status,
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
        },
      });
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;

      const sub = await prisma.subscription.findFirst({
        where: { stripeSubscriptionId: subscription.id },
      });
      if (!sub) break;

      await prisma.subscription.update({
        where: { id: sub.id },
        data: { status: "canceled", plan: "starter", cancelAtPeriodEnd: false },
      });
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as any;
      const sub = await prisma.subscription.findFirst({
        where: { stripeSubscriptionId: invoice.subscription || "" },
      });
      if (!sub) break;

      await prisma.subscription.update({
        where: { id: sub.id },
        data: { status: "past_due" },
      });
      break;
    }

    case "invoice.payment_succeeded": {
      const invoice = event.data.object as any;
      const sub = await prisma.subscription.findFirst({
        where: { stripeSubscriptionId: invoice.subscription || "" },
      });
      if (!sub) break;

      await prisma.subscription.update({
        where: { id: sub.id },
        data: { status: "active" },
      });
      break;
    }
  }

  return c.json({ received: true });
});

export { billingRouter };

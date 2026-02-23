import Stripe from "stripe";
import { prisma } from "./db";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || "";

export const stripe = new Stripe(stripeSecretKey);

export const PRICE_AMOUNT = 1200; // $12.00 in cents
export const PRICE_INTERVAL = "month" as const;

let cachedPriceId: string | null = null;

export async function getOrCreatePrice(): Promise<string> {
  if (cachedPriceId) return cachedPriceId;

  const prices = await stripe.prices.list({
    lookup_keys: ["ivf_buddy_monthly"],
    limit: 1,
  });

  if (prices.data.length > 0) {
    cachedPriceId = prices.data[0].id;
    return cachedPriceId;
  }

  const product = await stripe.products.create({
    name: "IVF Buddy",
    description: "Medication reminders, AI chat support, and calendar sync for your IVF cycle",
  });

  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: PRICE_AMOUNT,
    currency: "usd",
    recurring: { interval: PRICE_INTERVAL },
    lookup_key: "ivf_buddy_monthly",
  });

  cachedPriceId = price.id;
  return cachedPriceId;
}

export async function getOrCreateCustomer(userId: string, email: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { stripeCustomerId: true },
  });

  if (user?.stripeCustomerId) {
    return user.stripeCustomerId;
  }

  const customer = await stripe.customers.create({
    email,
    metadata: { userId },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { stripeCustomerId: customer.id },
  });

  return customer.id;
}

export async function createCheckoutSession(
  userId: string,
  email: string,
  returnUrl: string
): Promise<string> {
  const customerId = await getOrCreateCustomer(userId, email);
  const priceId = await getOrCreatePrice();

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${returnUrl}?checkout=success`,
    cancel_url: `${returnUrl}?checkout=canceled`,
    metadata: { userId },
  });

  return session.url!;
}

export async function createPortalSession(userId: string, returnUrl: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { stripeCustomerId: true },
  });

  if (!user?.stripeCustomerId) {
    throw new Error("No Stripe customer found");
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: returnUrl,
  });

  return session.url;
}

export async function hasActiveSubscription(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { subscriptionStatus: true, freeAccess: true },
  });

  if (!user) return false;
  if (user.freeAccess) return true;
  return user.subscriptionStatus === "active" || user.subscriptionStatus === "trialing";
}

export async function syncSubscriptionStatus(customerId: string): Promise<void> {
  const user = await prisma.user.findFirst({
    where: { stripeCustomerId: customerId },
  });

  if (!user) {
    console.error("No user found for Stripe customer:", customerId);
    return;
  }

  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 1,
  });

  if (subscriptions.data.length === 0) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        subscriptionId: null,
        subscriptionStatus: "none",
        subscriptionPeriodEnd: null,
        cardLast4: null,
      },
    });
    return;
  }

  const subscription = subscriptions.data[0];
  let cardLast4: string | null = null;

  if (subscription.default_payment_method) {
    const paymentMethod = await stripe.paymentMethods.retrieve(
      subscription.default_payment_method as string
    );
    cardLast4 = paymentMethod.card?.last4 || null;
  }

  const periodEnd = (subscription as any).current_period_end || (subscription as any).currentPeriodEnd;
  
  await prisma.user.update({
    where: { id: user.id },
    data: {
      subscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
      subscriptionPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
      cardLast4,
    },
  });
}

export async function getSubscriptionStatus(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      subscriptionStatus: true,
      subscriptionPeriodEnd: true,
      cardLast4: true,
      freeAccess: true,
    },
  });

  if (!user) return null;

  return {
    status: user.freeAccess ? "active" : user.subscriptionStatus,
    periodEnd: user.subscriptionPeriodEnd,
    cardLast4: user.cardLast4,
    freeAccess: user.freeAccess,
    isActive: user.freeAccess || user.subscriptionStatus === "active" || user.subscriptionStatus === "trialing",
  };
}

import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());

const args = new Set(process.argv.slice(2));
const isProductionCheck = args.has("--prod");

const requiredKeys = [
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "CLERK_SECRET_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "NEXT_PUBLIC_MAPBOX_TOKEN",
];

const recommendedPriceKeys = [
  "STRIPE_PRICE_STARTER",
  "STRIPE_PRICE_PRO",
  "STRIPE_PRICE_ELITE",
];

const recommendedSupabaseKeys = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];

const errors = [];
const warnings = [];

function readEnv(name) {
  return (process.env[name] ?? "").trim();
}

function pushMissingRequired(name) {
  errors.push(`Missing required env var: ${name}`);
}

for (const key of requiredKeys) {
  if (!readEnv(key)) {
    pushMissingRequired(key);
  }
}

const appUrl = readEnv("NEXT_PUBLIC_APP_URL");
if (appUrl) {
  try {
    const parsed = new URL(appUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      errors.push("NEXT_PUBLIC_APP_URL must use http:// or https://");
    }
    if (isProductionCheck) {
      if (parsed.protocol !== "https:") {
        errors.push("Production check requires NEXT_PUBLIC_APP_URL to use https://");
      }
      if (["localhost", "127.0.0.1"].includes(parsed.hostname)) {
        errors.push("Production check requires NEXT_PUBLIC_APP_URL to use a real domain");
      }
    }
  } catch {
    errors.push("NEXT_PUBLIC_APP_URL must be a valid absolute URL");
  }
}

const basemapToggle = readEnv("NEXT_PUBLIC_ENABLE_MAPBOX_BASEMAP");
if (basemapToggle && basemapToggle !== "true" && basemapToggle !== "false") {
  errors.push("NEXT_PUBLIC_ENABLE_MAPBOX_BASEMAP must be 'true' or 'false' when set");
}

const webhookSecret = readEnv("STRIPE_WEBHOOK_SECRET");
if (webhookSecret && !webhookSecret.startsWith("whsec_")) {
  warnings.push("STRIPE_WEBHOOK_SECRET does not start with 'whsec_'");
}

if (isProductionCheck) {
  const clerkPublishable = readEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY");
  const clerkSecret = readEnv("CLERK_SECRET_KEY");
  const stripeSecret = readEnv("STRIPE_SECRET_KEY");

  if (clerkPublishable && !clerkPublishable.startsWith("pk_live_")) {
    errors.push("Production check expects NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY to be a live key");
  }
  if (clerkSecret && !clerkSecret.startsWith("sk_live_")) {
    errors.push("Production check expects CLERK_SECRET_KEY to be a live key");
  }
  if (stripeSecret && !stripeSecret.startsWith("sk_live_")) {
    errors.push("Production check expects STRIPE_SECRET_KEY to be a live key");
  }
}

for (const key of recommendedPriceKeys) {
  if (!readEnv(key)) {
    warnings.push(`Recommended for subscriptions in production: ${key}`);
  }
}

const hasSupabaseUrl = Boolean(
  readEnv("NEXT_PUBLIC_SUPABASE_URL") || readEnv("SUPABASE_URL")
);
const hasSupabaseServiceRole = Boolean(readEnv("SUPABASE_SERVICE_ROLE_KEY"));
if (hasSupabaseUrl && !hasSupabaseServiceRole) {
  warnings.push(
    "Supabase URL is set but SUPABASE_SERVICE_ROLE_KEY is missing (profile API writes will fail)."
  );
} else if (!hasSupabaseUrl && hasSupabaseServiceRole) {
  warnings.push(
    "SUPABASE_SERVICE_ROLE_KEY is set but NEXT_PUBLIC_SUPABASE_URL is missing."
  );
} else if (!hasSupabaseUrl) {
  for (const key of recommendedSupabaseKeys) {
    if (!readEnv(key)) {
      warnings.push(`Recommended for cloud profile persistence: ${key}`);
    }
  }
}

const modeLabel = isProductionCheck ? "production" : "standard";
console.log(`Running ${modeLabel} preflight checks...\n`);

if (warnings.length > 0) {
  console.log("Warnings:");
  for (const warning of warnings) {
    console.log(`- ${warning}`);
  }
  console.log("");
}

if (errors.length > 0) {
  console.error("Preflight failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("Preflight passed.");

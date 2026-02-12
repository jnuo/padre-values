import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: process.env.NODE_ENV === "production",

  // Sample 100% of errors (free tier is 5K/month, plenty for us)
  sampleRate: 1.0,

  // Disable performance monitoring to stay within free tier
  tracesSampleRate: 0,
});

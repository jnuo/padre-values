import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* config options here */
};

export default withSentryConfig(nextConfig, {
  // Suppress Sentry CLI logs during build
  silent: true,

  // Disable source map upload (no SENTRY_AUTH_TOKEN needed)
  sourcemaps: {
    disable: true,
  },

  // Disable telemetry
  telemetry: false,
});

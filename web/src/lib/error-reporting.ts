import * as Sentry from "@sentry/nextjs";

interface ErrorContext {
  op: string;
  [key: string]: unknown;
}

export function reportError(error: unknown, context?: ErrorContext): void {
  const tag = context?.op ? `[${context.op}]` : "[error]";
  console.error(tag, error);

  const err = error instanceof Error ? error : new Error(String(error));
  Sentry.withScope((scope) => {
    if (context) {
      const { op, ...meta } = context;
      scope.setTag("op", op);
      for (const [key, value] of Object.entries(meta)) {
        scope.setExtra(key, value);
      }
    }
    Sentry.captureException(err);
  });
}

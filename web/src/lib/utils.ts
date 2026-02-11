import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Add colloquial Turkish names to medical terms for readability.
 * e.g. "Tansiyon (Sistolik)" → "Büyük Tansiyon (Sistolik)"
 */
const FRIENDLY_NAMES: [RegExp, string][] = [
  [/sistolik/i, "Büyük Tansiyon (Sistolik)"],
  [/diastolik/i, "Küçük Tansiyon (Diastolik)"],
];

export function friendlyMetricName(name: string): string {
  for (const [pattern, friendly] of FRIENDLY_NAMES) {
    if (pattern.test(name)) return friendly;
  }
  return name;
}

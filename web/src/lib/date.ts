const TURKEY_TIMEZONE = "Europe/Istanbul";

export function isValidISODate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export function parseToISO(dateStr: string): string | null {
  // Support ISO (YYYY-MM-DD) and US (MM/DD/YYYY)
  if (isValidISODate(dateStr)) return dateStr;
  const mdy = /^(\d{2})\/(\d{2})\/(\d{4})$/;
  const m = dateStr.match(mdy);
  if (m) {
    const [, mm, dd, yyyy] = m;
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }
  return null;
}

export function compareDateAsc(a: string, b: string): number {
  // Parse to ISO first to ensure proper comparison regardless of input format
  const isoA = parseToISO(a) ?? a;
  const isoB = parseToISO(b) ?? b;
  if (isoA === isoB) return 0;
  return isoA < isoB ? -1 : 1;
}

/**
 * Format date as short Turkish format: "15.01.26"
 * Used in charts
 */
export function formatTR(dateStr: string): string {
  const iso = parseToISO(dateStr);
  if (!iso) return dateStr;
  const [year, month, day] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(year, month - 1, day));
  return dt.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    timeZone: TURKEY_TIMEZONE,
  });
}

/**
 * Format date in Turkish: "29 Oca 2025"
 * Always uses Turkey timezone
 */
export function formatDateTR(dateString: string | null): string {
  if (!dateString) return "—";

  // For date-only strings like "2026-01-15", parse directly to avoid timezone shift
  if (!dateString.includes("T")) {
    const [year, month, day] = dateString.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: TURKEY_TIMEZONE,
    });
  }

  // For full ISO strings, use timezone conversion
  const date = new Date(dateString);
  return date.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: TURKEY_TIMEZONE,
  });
}

/**
 * Format datetime in Turkish: "29 Oca 2025, 10:30"
 * Always uses Turkey timezone
 */
export function formatDateTimeTR(dateString: string | null): string {
  if (!dateString) return "—";

  const date = new Date(dateString);
  return date.toLocaleString("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TURKEY_TIMEZONE,
  });
}

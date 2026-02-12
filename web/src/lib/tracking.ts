export type TrackingMeasurement = {
  id: string;
  profile_id: string;
  type: "blood_pressure" | "weight";
  measured_at: string;
  systolic: number | null;
  diastolic: number | null;
  pulse: number | null;
  weight_kg: number | null;
  notes: string | null;
  created_at: string;
};

export type BPStatus = {
  label: string;
  color: string;
  bg: string;
  borderColor: string;
};

/**
 * Classify blood pressure. Ranges per AHA/ESC 2024 guidelines, simplified.
 */
export function getBPStatus(systolic: number, diastolic: number): BPStatus {
  if (systolic < 90 || diastolic < 60) {
    return {
      label: "Düşük",
      color: "text-status-critical",
      bg: "bg-status-critical/10",
      borderColor: "border-l-status-critical",
    };
  }
  if (systolic >= 140 || diastolic >= 90) {
    return {
      label: "Yüksek",
      color: "text-status-critical",
      bg: "bg-status-critical/10",
      borderColor: "border-l-status-critical",
    };
  }
  if (systolic >= 120 || diastolic >= 80) {
    return {
      label: "Yüksek Normal",
      color: "text-status-warning",
      bg: "bg-status-warning/10",
      borderColor: "border-l-status-warning",
    };
  }
  return {
    label: "Normal",
    color: "text-status-normal",
    bg: "bg-status-normal/10",
    borderColor: "border-l-status-normal",
  };
}

/**
 * Format a date string for display in tracking dialogs (Turkish locale).
 */
export function formatTrackingDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "short",
  });
}

/**
 * Format a date string with time for blood pressure dialog.
 */
export function formatTrackingDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Format a date string as relative time (Turkish).
 */
export function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours < 1) return "Az önce";
  if (diffHours < 24) return `${Math.floor(diffHours)} saat önce`;
  if (diffHours < 48) return "Dün";
  return date.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
}

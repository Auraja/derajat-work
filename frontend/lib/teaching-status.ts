import type { TeachingSession } from "@/lib/types";

export const teachingStatusOptions = [
  { value: "draft", label: "Draf" },
  { value: "preparing", label: "Persiapan" },
  { value: "ready", label: "Siap" },
  { value: "scheduled", label: "Terjadwal" },
  { value: "in_progress", label: "Berlangsung" },
  { value: "completed", label: "Selesai" },
  { value: "cancelled", label: "Dibatalkan" },
] satisfies Array<{ value: NonNullable<TeachingSession["status"]>; label: string }>;

export function teachingStatusLabel(status?: TeachingSession["status"]) {
  if (status === "archived") return "Diarsipkan";
  return teachingStatusOptions.find((option) => option.value === status)?.label ?? "Draf";
}

export function teachingStatusTone(status?: TeachingSession["status"]) {
  if (status === "completed") return "good" as const;
  if (status === "ready" || status === "scheduled" || status === "in_progress") {
    return "info" as const;
  }
  if (status === "cancelled") return "warn" as const;
  return "neutral" as const;
}

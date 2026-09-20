import type { TeachingSession } from "@/lib/types";

export function formatTeachingSessionSchedule(
  session: Partial<Pick<TeachingSession, "scheduled_at" | "session_date">>,
  dateStyle: "medium" | "full" = "full",
) {
  if (session.scheduled_at) {
    return new Intl.DateTimeFormat("id-ID", {
      dateStyle,
      timeStyle: "short",
    }).format(new Date(session.scheduled_at));
  }

  if (session.session_date) {
    const [year, month, day] = session.session_date.split("-").map(Number);
    return new Intl.DateTimeFormat("id-ID", { dateStyle }).format(
      new Date(year, month - 1, day),
    );
  }

  return "Belum dijadwalkan";
}

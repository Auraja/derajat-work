import { describe, expect, it } from "vitest";
import { formatTeachingSessionSchedule } from "@/lib/session-schedule";

describe("formatTeachingSessionSchedule", () => {
  it("shows the saved session_date when scheduled_at is absent", () => {
    expect(formatTeachingSessionSchedule({ session_date: "2026-09-10" })).toContain(
      "10 September 2026",
    );
  });
});

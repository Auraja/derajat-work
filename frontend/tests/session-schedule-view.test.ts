import { describe, expect, it } from "vitest";
import { currentMonthValue, fetchAllTeachingSessions } from "@/components/session-schedule-view";

describe("currentMonthValue", () => {
  it("derives the selected schedule month from the runtime date", () => {
    expect(currentMonthValue(new Date(2031, 1, 4))).toBe("2031-02");
  });
});

describe("fetchAllTeachingSessions", () => {
  it("loads every API page so conflict detection is not capped at 100 sessions", async () => {
    const request = async (path: string) => ({
      items: [{ id: path.includes("page=1") ? 1 : 101 }],
      pages: 2,
    });

    const sessions = await fetchAllTeachingSessions(3, request as never);

    expect(sessions.map((session) => session.id)).toEqual([1, 101]);
  });
});

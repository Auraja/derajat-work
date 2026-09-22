"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { TeachingActivity, TeachingSession } from "@/lib/types";

export function currentMonthValue(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

type SessionPage = { items: TeachingSession[]; pages?: number };
type SessionRequester = (path: string) => Promise<SessionPage>;

export async function fetchAllTeachingSessions(
  workspaceId: number,
  request: SessionRequester = api,
) {
  const sessions: TeachingSession[] = [];
  let page = 1;
  let pages = 1;
  do {
    const value = await request(
      `/workspaces/${workspaceId}/teaching/sessions?page=${page}&page_size=100&sort=scheduled_at&order=asc`,
    );
    sessions.push(...value.items);
    pages = Math.max(1, value.pages ?? 1);
    page += 1;
  } while (page <= pages);
  return sessions;
}

function activityRange(activity: TeachingActivity, month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const start = new Date(year, monthNumber - 1, 1);
  const end = new Date(year, monthNumber, 0);
  const activityStart = new Date(`${activity.startDate}T00:00:00`);
  const activityEnd = new Date(`${activity.endDate}T00:00:00`);
  if (activityEnd < start || activityStart > end) return null;
  const days = end.getDate();
  const clippedStart = Math.max(1, activityStart < start ? 1 : activityStart.getDate());
  const clippedEnd = Math.min(days, activityEnd > end ? days : activityEnd.getDate());
  return {
    left: `${((clippedStart - 1) / days) * 100}%`,
    width: `${((clippedEnd - clippedStart + 1) / days) * 100}%`,
  };
}

function instructorsFor(item: TeachingSession) {
  return item.instructors?.length ? item.instructors : item.instructor ? [item.instructor] : [];
}

function hasConflict(item: TeachingSession, all: TeachingSession[]) {
  const names = instructorsFor(item);
  return all.some(
    (other) =>
      other.id !== item.id &&
      names.some((name) => instructorsFor(other).includes(name)) &&
      (item.activities || []).some((activity) =>
        (other.activities || []).some(
          (otherActivity) =>
            activity.startDate <= otherActivity.endDate &&
            otherActivity.startDate <= activity.endDate,
        ),
      ),
  );
}

export function SessionScheduleView({ workspaceId }: { workspaceId: number }) {
  const [month, setMonth] = useState(() => currentMonthValue());
  const [sessions, setSessions] = useState<TeachingSession[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!workspaceId) return;
    let active = true;
    fetchAllTeachingSessions(workspaceId)
      .then((value) => {
        if (active) setSessions(value);
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : "Jadwal belum dapat dimuat.");
      });
    return () => {
      active = false;
    };
  }, [workspaceId]);

  const visible = useMemo(
    () => sessions.filter((item) =>
      (item.activities || []).some(
        (activity) => activity.endDate >= `${month}-01` && activity.startDate <= `${month}-31`,
      ),
    ),
    [sessions, month],
  );

  return (
    <section className="surface overflow-hidden p-5 sm:p-7" aria-labelledby="schedule-heading">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-line pb-5">
        <div>
          <p className="eyebrow">Tampilan jadwal</p>
          <h2 id="schedule-heading" className="editorial-title mt-2 text-2xl">Rentang kegiatan</h2>
        </div>
        <label className="text-xs font-semibold text-muted">
          Bulan
          <input
            className="control mt-1 block w-auto"
            type="month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
            aria-label="Bulan jadwal"
          />
        </label>
      </div>
      {error ? (
        <p role="alert" className="error-box">{error}</p>
      ) : visible.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">Belum ada kegiatan pada bulan ini.</p>
      ) : (
        <div className="space-y-4">
          {visible.map((item) => {
            const conflict = hasConflict(item, sessions);
            return (
              <div key={item.id} className="grid gap-2 border-b border-line pb-4 last:border-0 md:grid-cols-[minmax(12rem,1fr)_minmax(20rem,2fr)] md:items-center">
                <div>
                  <p className="text-sm font-semibold text-primary">{item.title}</p>
                  <p className="mt-1 text-xs text-muted">
                    {instructorsFor(item).join(", ") || "Pengajar belum diisi"}
                    {conflict ? " · Bentrok" : ""}
                  </p>
                </div>
                <div className="relative h-8 overflow-hidden rounded-sm bg-[#eeeae2] dark:bg-[#292621]">
                  {(item.activities || []).map((activity) => {
                    const range = activityRange(activity, month);
                    return range ? (
                      <span
                        key={`${activity.type}-${activity.startDate}-${activity.endDate}`}
                        className={`absolute top-1 flex h-6 items-center overflow-hidden rounded-sm px-2 text-xs font-semibold text-white ${conflict ? "bg-red-700" : "bg-[#7a3e32]"}`}
                        style={range}
                        title={`${activity.type}: ${activity.startDate} – ${activity.endDate}`}
                      >
                        {activity.type}
                      </span>
                    ) : null;
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

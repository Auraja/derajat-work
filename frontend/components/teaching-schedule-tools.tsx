"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { TeachingSession, TeachingActivity } from "@/lib/types";
import { Button } from "@/components/ui";

const template = { month: 9, year: 2026, sessions: [] };

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
  return { left: `${((clippedStart - 1) / days) * 100}%`, width: `${((clippedEnd - clippedStart + 1) / days) * 100}%` };
}

function hasConflict(item: TeachingSession, all: TeachingSession[]) {
  const names = item.instructors?.length ? item.instructors : item.instructor ? [item.instructor] : [];
  return all.some((other) => other.id !== item.id && names.some((name) => (other.instructors?.length ? other.instructors : other.instructor ? [other.instructor] : []).includes(name)) && (item.activities || []).some((a) => (other.activities || []).some((b) => a.startDate <= b.endDate && b.startDate <= a.endDate)));
}

export function TeachingScheduleTools({ workspaceId }: { workspaceId: number }) {
  const [month, setMonth] = useState("2026-09");
  const [sessions, setSessions] = useState<TeachingSession[]>([]);
  const [json, setJson] = useState(JSON.stringify(template, null, 2));
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!workspaceId) return;
    void api<{ items: TeachingSession[] }>(`/workspaces/${workspaceId}/teaching/sessions?page=1&page_size=100&sort=scheduled_at&order=asc`).then((value) => setSessions(value.items)).catch(() => undefined);
  }, [workspaceId]);
  const visible = useMemo(() => sessions.filter((item) => (item.activities || []).some((activity) => activity.endDate >= `${month}-01` && activity.startDate <= `${month}-31`)), [sessions, month]);
  async function importJson() {
    setBusy(true); setError(""); setMessage("");
    try {
      const payload = JSON.parse(json) as { sessions?: unknown[] };
      if (!Array.isArray(payload.sessions) || payload.sessions.length === 0) throw new Error("JSON harus memiliki array sessions yang berisi data.");
      await api(`/workspaces/${workspaceId}/teaching/sessions/import`, { method: "POST", body: JSON.stringify(payload) });
      setMessage(`${payload.sessions.length} sesi berhasil diimport.`);
      window.location.reload();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "JSON tidak valid."); }
    finally { setBusy(false); }
  }
  return <section className="mt-8 space-y-5">
    <div className="surface p-5 sm:p-7"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold text-primary">Import dari AI eksternal</h2><p className="text-sm text-muted">Paste JSON dari Hermes atau AI lain. Aplikasi hanya memvalidasi dan menyimpan.</p></div><Button type="button" variant="secondary" onClick={() => setJson(JSON.stringify(template, null, 2))}>Template JSON</Button></div><textarea className="control min-h-40 w-full font-mono text-xs" value={json} onChange={(event) => setJson(event.target.value)} aria-label="JSON jadwal" /><div className="mt-3 flex items-center gap-3"><Button type="button" disabled={busy} onClick={() => void importJson()}>{busy ? "Mengimport…" : "Validasi & import"}</Button>{message && <span className="text-sm text-green-700">{message}</span>}{error && <span className="text-sm text-red-700">{error}</span>}</div></div>
    <div className="surface overflow-hidden p-5 sm:p-7"><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold text-primary">Gantt jadwal mengajar</h2><p className="text-sm text-muted">Rentang aktivitas dan indikator bentrok pengajar.</p></div><input className="control w-auto" type="month" value={month} onChange={(event) => setMonth(event.target.value)} aria-label="Bulan Gantt" /></div>{visible.length === 0 ? <p className="text-sm text-muted">Belum ada aktivitas pada bulan ini.</p> : <div className="space-y-3">{visible.map((item) => <div key={item.id} className="grid gap-2 md:grid-cols-[minmax(12rem,1fr)_minmax(20rem,2fr)] md:items-center"><div className="truncate text-sm font-medium" title={item.title}>{item.title}{hasConflict(item, sessions) && <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">Bentrok</span>}</div><div className="relative h-8 overflow-hidden rounded bg-slate-100">{(item.activities || []).map((activity) => { const range = activityRange(activity, month); return range ? <span key={`${activity.type}-${activity.startDate}`} className={`absolute top-1 flex h-6 items-center overflow-hidden rounded px-2 text-xs font-semibold text-white ${hasConflict(item, sessions) ? "bg-red-600" : "bg-primary"}`} style={range} title={`${activity.type}: ${activity.startDate} – ${activity.endDate}`}>{activity.type}</span> : null; })}</div></div>)}</div>}</div>
  </section>;
}

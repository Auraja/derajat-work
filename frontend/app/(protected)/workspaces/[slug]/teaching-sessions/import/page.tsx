"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Breadcrumb, Button, ButtonLink, PageHeader, Textarea } from "@/components/ui";
import { api } from "@/lib/api";
import type { Workspace } from "@/lib/types";

type ImportActivity = {
  type: string;
  startDate: string;
  endDate: string;
  mode?: string | null;
};

type ImportSession = Record<string, unknown> & {
  title: string;
  location?: string | null;
  participantCount?: number | null;
  participant_count?: number | null;
  participantLabel?: string | null;
  participant_label?: string | null;
  source?: unknown;
  instructors: string[];
  activities: ImportActivity[];
};

type ImportPayload = { sessions: ImportSession[] };

const jsonTemplate = JSON.stringify(
  {
    sessions: [
      {
        title: "Kelas AI",
        location: "Lab 2",
        participantCount: 24,
        participantLabel: "Mahasiswa semester 3",
        instructors: ["Nama pengajar"],
        activities: [
          {
            type: "workshop",
            startDate: "2026-10-10",
            endDate: "2026-10-11",
            mode: "offline",
          },
        ],
      },
    ],
  },
  null,
  2,
);

const rootFields = new Set(["sessions"]);
const sessionFields = new Set([
  "title", "topic", "description", "audience", "location", "participantCount",
  "participant_count", "participantLabel", "participant_label", "source", "difficulty",
  "instructor", "instructors", "activities", "scheduled_at", "duration_minutes",
  "session_type", "session_date", "status", "notes", "module_id",
]);
const activityFields = new Set(["type", "startDate", "endDate", "mode"]);
const nullableTextFields = [
  "topic", "description", "audience", "location", "participantLabel",
  "participant_label", "difficulty", "instructor", "session_type", "notes",
] as const;
const validStatuses = new Set([
  "draft", "preparing", "ready", "scheduled", "in_progress", "completed", "cancelled",
]);

function unknownField(value: object, allowed: Set<string>) {
  return Object.keys(value).find((key) => !allowed.has(key));
}

function isValidIsoDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function validateOptionalSessionFields(session: Record<string, unknown>, number: number) {
  for (const field of nullableTextFields) {
    const value = session[field];
    if (value !== undefined && value !== null && typeof value !== "string") {
      throw new Error(`Sesi ${number}: ${field} harus berupa teks atau null.`);
    }
  }
  for (const field of ["participantCount", "participant_count"] as const) {
    const value = session[field];
    if (value !== undefined && value !== null && (!Number.isInteger(value) || Number(value) < 0)) {
      throw new Error(`Sesi ${number}: ${field} harus berupa bilangan bulat non-negatif atau null.`);
    }
  }
  const duration = session.duration_minutes;
  if (duration !== undefined && duration !== null && (!Number.isInteger(duration) || Number(duration) < 1 || Number(duration) > 1440)) {
    throw new Error(`Sesi ${number}: duration_minutes harus berupa bilangan bulat 1–1440 atau null.`);
  }
  const moduleId = session.module_id;
  if (moduleId !== undefined && moduleId !== null && !Number.isInteger(moduleId)) {
    throw new Error(`Sesi ${number}: module_id harus berupa bilangan bulat atau null.`);
  }
  const source = session.source;
  if (source !== undefined && source !== "manual" && source !== "external_ai") {
    throw new Error(`Sesi ${number}: source tidak valid.`);
  }
  const status = session.status;
  if (status !== undefined && (typeof status !== "string" || !validStatuses.has(status))) {
    throw new Error(`Sesi ${number}: status tidak valid.`);
  }
  const sessionDate = session.session_date;
  if (sessionDate !== undefined && sessionDate !== null && (typeof sessionDate !== "string" || !isValidIsoDate(sessionDate))) {
    throw new Error(`Sesi ${number}: session_date tidak valid.`);
  }
  const scheduledAt = session.scheduled_at;
  if (scheduledAt !== undefined && scheduledAt !== null && (typeof scheduledAt !== "string" || Number.isNaN(Date.parse(scheduledAt)))) {
    throw new Error(`Sesi ${number}: scheduled_at tidak valid.`);
  }
}

function validateImportPayload(value: unknown): ImportPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("JSON harus memiliki array sessions yang berisi minimal satu sesi.");
  }
  const rootUnknown = unknownField(value, rootFields);
  if (rootUnknown) {
    throw new Error(`Field JSON tidak dikenal: ${rootUnknown}.`);
  }
  if (!Array.isArray((value as { sessions?: unknown }).sessions)) {
    throw new Error("JSON harus memiliki array sessions yang berisi minimal satu sesi.");
  }
  const sessions = (value as { sessions: unknown[] }).sessions;
  if (sessions.length === 0) {
    throw new Error("JSON harus memiliki array sessions yang berisi minimal satu sesi.");
  }
  if (sessions.length > 100) {
    throw new Error("Maksimal 100 sesi dalam sekali import.");
  }

  const normalized = sessions.map((rawSession, sessionIndex) => {
    const number = sessionIndex + 1;
    if (!rawSession || typeof rawSession !== "object" || Array.isArray(rawSession)) {
      throw new Error(`Sesi ${number}: data sesi tidak valid.`);
    }
    const sessionUnknown = unknownField(rawSession, sessionFields);
    if (sessionUnknown) {
      throw new Error(`Sesi ${number}: field tidak dikenal: ${sessionUnknown}.`);
    }
    validateOptionalSessionFields(rawSession as Record<string, unknown>, number);
    const session = rawSession as Partial<ImportSession>;
    if (typeof session.title !== "string" || !session.title.trim()) {
      throw new Error(`Sesi ${number}: judul wajib diisi.`);
    }
    if (!Array.isArray(session.instructors) || session.instructors.length === 0 || !session.instructors.every((name) => typeof name === "string" && name.trim())) {
      throw new Error(`Sesi ${number}: pengajar wajib diisi.`);
    }
    if (!Array.isArray(session.activities) || session.activities.length === 0) {
      throw new Error(`Sesi ${number}: kegiatan wajib diisi.`);
    }
    session.activities.forEach((activity, activityIndex) => {
      const activityNumber = activityIndex + 1;
      if (!activity || typeof activity !== "object" || Array.isArray(activity)) {
        throw new Error(`Sesi ${number}, kegiatan ${activityNumber}: data kegiatan tidak valid.`);
      }
      const activityUnknown = unknownField(activity, activityFields);
      if (activityUnknown) {
        throw new Error(`Sesi ${number}, kegiatan ${activityNumber}: field tidak dikenal: ${activityUnknown}.`);
      }
      if (!activity || typeof activity.type !== "string" || !activity.type.trim()) {
        throw new Error(`Sesi ${number}, kegiatan ${activityNumber}: jenis kegiatan wajib diisi.`);
      }
      if (typeof activity.startDate !== "string" || !activity.startDate) {
        throw new Error(`Sesi ${number}, kegiatan ${activityNumber}: tanggal mulai wajib diisi.`);
      }
      if (typeof activity.endDate !== "string" || !activity.endDate) {
        throw new Error(`Sesi ${number}, kegiatan ${activityNumber}: tanggal selesai wajib diisi.`);
      }
      if (!isValidIsoDate(activity.startDate)) {
        throw new Error(`Sesi ${number}, kegiatan ${activityNumber}: tanggal mulai tidak valid.`);
      }
      if (!isValidIsoDate(activity.endDate)) {
        throw new Error(`Sesi ${number}, kegiatan ${activityNumber}: tanggal selesai tidak valid.`);
      }
      if (activity.mode !== undefined && activity.mode !== null && typeof activity.mode !== "string") {
        throw new Error(`Sesi ${number}, kegiatan ${activityNumber}: mode harus berupa teks atau null.`);
      }
      if (activity.endDate < activity.startDate) {
        throw new Error(`Sesi ${number}, kegiatan ${activityNumber}: tanggal selesai tidak boleh sebelum tanggal mulai.`);
      }
    });
    return {
      ...session,
      title: session.title.trim(),
      instructors: session.instructors.filter((name): name is string => typeof name === "string" && Boolean(name.trim())).map((name) => name.trim()),
      activities: session.activities,
      source: "external_ai",
    } as ImportSession;
  });

  return { sessions: normalized };
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

function participantText(session: ImportSession) {
  const count = session.participantCount ?? session.participant_count;
  const label = session.participantLabel ?? session.participant_label;
  return [count, label].filter((value) => value !== null && value !== undefined && value !== "").join(" · ");
}

export default function TeachingSessionImportPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [json, setJson] = useState(jsonTemplate);
  const [preview, setPreview] = useState<ImportPayload | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    api<Workspace>(`/workspaces/${slug}`)
      .then((value) => {
        if (active) setWorkspace(value);
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : "Ruang belum dapat dimuat.");
      });
    return () => {
      active = false;
    };
  }, [slug]);

  function validateAndPreview() {
    setError("");
    try {
      const parsed = JSON.parse(json) as unknown;
      setPreview(validateImportPayload(parsed));
    } catch (reason) {
      setPreview(null);
      setError(
        reason instanceof SyntaxError
          ? "JSON tidak valid. Periksa tanda koma, kurung, dan tanda kutip."
          : reason instanceof Error
            ? reason.message
            : "JSON tidak valid.",
      );
    }
  }

  async function saveAll() {
    if (!workspace || !preview) return;
    setSaving(true);
    setError("");
    try {
      await api(`/workspaces/${workspace.id}/teaching/sessions/import`, {
        method: "POST",
        body: JSON.stringify(preview),
      });
      router.push(`/workspaces/${slug}/teaching-sessions`);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Sesi belum dapat disimpan.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Ruang", href: `/workspaces/${slug}` },
          { label: "Sesi Mengajar", href: `/workspaces/${slug}/teaching-sessions` },
          { label: "Import JSON" },
        ]}
      />
      <PageHeader
        title="Import Sesi Mengajar"
        description="Tempel data JSON, periksa hasilnya, lalu simpan semua sesi setelah Anda yakin."
        actions={
          <ButtonLink variant="secondary" href={`/workspaces/${slug}/teaching-sessions`}>
            Kembali ke daftar
          </ButtonLink>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,.8fr)] xl:items-start">
        <section className="surface p-5 sm:p-7" aria-labelledby="json-heading">
          <h2 id="json-heading" className="editorial-title text-2xl">Data JSON</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Gunakan format contoh berikut. Validasi tidak akan menyimpan data.
          </p>
          <div className="mt-5">
            <Textarea
              aria-label="Data JSON"
              className="min-h-96 font-mono text-xs leading-5"
              spellCheck={false}
              value={json}
              onChange={(event) => {
                setJson(event.target.value);
                setPreview(null);
                setError("");
              }}
            />
          </div>
          {error && <div role="alert" className="error-box mt-4">{error}</div>}
          <div className="mt-5 flex flex-wrap gap-3">
            <Button type="button" disabled={!workspace || saving} onClick={validateAndPreview}>
              Validasi &amp; tinjau
            </Button>
          </div>
        </section>

        <section className="surface p-5 sm:p-7" aria-label="Pratinjau sesi">
          <h2 className="editorial-title text-2xl">Pratinjau</h2>
          {!preview ? (
            <p className="mt-3 text-sm leading-6 text-muted">
              Hasil validasi akan tampil di sini sebelum data disimpan.
            </p>
          ) : (
            <>
              <p className="mt-2 text-sm text-muted">{preview.sessions.length} sesi siap disimpan.</p>
              <div className="mt-5 space-y-4">
                {preview.sessions.map((session, sessionIndex) => (
                  <article key={`${session.title}-${sessionIndex}`} className="rounded-lg border border-line p-4">
                    <h3 className="font-semibold text-primary">{session.title}</h3>
                    {session.location && <p className="mt-2 text-sm">{session.location}</p>}
                    {participantText(session) && <p className="mt-1 text-sm text-muted">{participantText(session)}</p>}
                    <dl className="mt-4 grid gap-3 text-sm">
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Pengajar</dt>
                        <dd className="mt-1">{session.instructors.join(", ")}</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Kegiatan</dt>
                        <dd className="mt-1 space-y-2">
                          {session.activities.map((activity, activityIndex) => (
                            <div key={`${activity.type}-${activity.startDate}-${activityIndex}`}>
                              <span className="font-medium">{activity.type}</span>
                              {" · "}{formatDate(activity.startDate)} – {formatDate(activity.endDate)}
                              {activity.mode ? ` · ${activity.mode}` : ""}
                            </div>
                          ))}
                        </dd>
                      </div>
                    </dl>
                  </article>
                ))}
              </div>
              <Button type="button" className="mt-6 w-full sm:w-auto" disabled={saving} onClick={saveAll}>
                {saving ? "Menyimpan…" : "Simpan semua"}
              </Button>
            </>
          )}
        </section>
      </div>
    </>
  );
}

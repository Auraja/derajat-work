"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import {
  Badge,
  Breadcrumb,
  Button,
  ButtonLink,
  PageHeader,
  Skeleton,
} from "@/components/ui";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { formatTeachingSessionSchedule } from "@/lib/session-schedule";
import { teachingStatusLabel, teachingStatusTone } from "@/lib/teaching-status";
import type { TeachingActivity, TeachingSession } from "@/lib/types";

function formatDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(
    new Date(year, month - 1, day),
  );
}

function activitySchedule(activity: TeachingActivity) {
  const start = formatDate(activity.startDate);
  const end = formatDate(activity.endDate);
  return activity.startDate === activity.endDate ? start : `${start} – ${end}`;
}

function instructorNames(session: TeachingSession) {
  if (session.instructors?.length) return session.instructors.join(", ");
  return session.instructor || "Belum diisi";
}

export default function SessionDetail() {
  const { slug, id } = useParams<{ slug: string; id: string }>();
  const router = useRouter();
  const { show } = useToast();
  const [session, setSession] = useState<TeachingSession | null>(null);
  const [loadError, setLoadError] = useState("");
  const [retry, setRetry] = useState(0);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setSession(null);
      setLoadError("");
    });
    api<TeachingSession>(`/teaching/sessions/${id}`)
      .then((value) => {
        if (active) setSession(value);
      })
      .catch((reason) => {
        if (!active) return;
        setLoadError(reason instanceof Error ? reason.message : "Sesi belum dapat dimuat.");
      });
    return () => {
      active = false;
    };
  }, [id, retry]);

  async function archive() {
    setBusy(true);
    try {
      await api(`/teaching/sessions/${id}`, { method: "DELETE" });
      show("Sesi berhasil diarsipkan.");
      router.replace(`/workspaces/${slug}/teaching-sessions`);
      router.refresh();
    } catch (reason) {
      show(reason instanceof Error ? reason.message : "Gagal mengarsipkan sesi.", "error");
      setBusy(false);
    }
  }

  if (loadError) {
    return (
      <div role="alert" className="error-box flex items-center justify-between gap-4">
        <span>{loadError}</span>
        <Button type="button" variant="secondary" onClick={() => setRetry((value) => value + 1)}>
          Coba lagi
        </Button>
      </div>
    );
  }

  if (!session) {
    return (
      <>
        <Skeleton className="h-10 w-80" />
        <Skeleton className="mt-7 h-64" />
      </>
    );
  }

  const participants = session.participant_count == null
    ? session.participant_label || "Belum diisi"
    : `${session.participant_count}${session.participant_label ? ` ${session.participant_label}` : " peserta"}`;
  const primaryType = session.activities?.[0]?.type ?? session.session_type ?? "Sesi mengajar";

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Ruang", href: `/workspaces/${slug}` },
          { label: "Sesi Mengajar", href: `/workspaces/${slug}/teaching-sessions` },
          { label: session.title },
        ]}
      />
      <PageHeader
        title={session.title}
        description={`${primaryType}${session.topic ? ` · ${session.topic}` : ""}`}
        actions={
          <>
            <ButtonLink variant="secondary" href={`/workspaces/${slug}/teaching-sessions/${id}/edit`}>
              Edit sesi
            </ButtonLink>
            <Button variant="danger" onClick={() => setConfirm(true)}>Arsipkan</Button>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          <section className="surface p-6">
            <h2 className="font-serif text-xl text-primary">Kegiatan</h2>
            {session.activities?.length ? (
              <div className="mt-4 space-y-3">
                {session.activities.map((activity, index) => (
                  <article key={`${activity.type}-${activity.startDate}-${activity.endDate}-${index}`} className="rounded-md border border-line p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-semibold text-primary">{activity.type}</h3>
                      {activity.mode && <span className="text-xs font-semibold text-muted">{activity.mode}</span>}
                    </div>
                    <p className="mt-2 text-sm text-muted">{activitySchedule(activity)}</p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted">{formatTeachingSessionSchedule(session)}</p>
            )}
          </section>
          <section className="surface p-6">
            <h2 className="font-serif text-xl text-primary">Deskripsi</h2>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-muted">{session.description || "Belum ada deskripsi."}</p>
          </section>
          <section className="surface p-6">
            <h2 className="font-serif text-xl text-primary">Catatan</h2>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-muted">{session.notes || "Belum ada catatan."}</p>
          </section>
        </div>

        <aside className="surface h-fit p-5">
          <h2 className="font-serif text-lg text-primary">Informasi sesi</h2>
          <dl className="mt-4 space-y-4 text-sm">
            <div>
              <dt className="text-xs text-muted">Status</dt>
              <dd className="mt-1"><Badge tone={teachingStatusTone(session.status)}>{teachingStatusLabel(session.status)}</Badge></dd>
            </div>
            <div><dt className="text-xs text-muted">Lokasi</dt><dd className="mt-1 font-medium">{session.location || "Belum diisi"}</dd></div>
            <div><dt className="text-xs text-muted">Peserta</dt><dd className="mt-1 font-medium">{participants}</dd></div>
            <div><dt className="text-xs text-muted">Audiens</dt><dd className="mt-1 font-medium">{session.audience || "Belum diisi"}</dd></div>
            <div><dt className="text-xs text-muted">Pengajar</dt><dd className="mt-1 font-medium">{instructorNames(session)}</dd></div>
            <div><dt className="text-xs text-muted">Durasi</dt><dd className="mt-1 font-medium">{session.duration_minutes ? `${session.duration_minutes} menit` : "Belum diisi"}</dd></div>
          </dl>
        </aside>
      </div>

      <Dialog
        open={confirm}
        title="Arsipkan sesi?"
        description="Sesi akan disembunyikan dari daftar aktif dan tetap tersimpan sebagai arsip."
        confirmLabel="Arsipkan sesi"
        busy={busy}
        onClose={() => setConfirm(false)}
        onConfirm={archive}
      />
    </>
  );
}

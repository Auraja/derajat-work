"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { formatTeachingSessionSchedule } from "@/lib/session-schedule";
import { teachingStatusLabel, teachingStatusTone } from "@/lib/teaching-status";
import type { TeachingSession } from "@/lib/types";
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
        setLoadError(
          reason instanceof Error ? reason.message : "Sesi belum dapat dimuat.",
        );
      });
    return () => {
      active = false;
    };
  }, [id, retry]);
  async function remove() {
    setBusy(true);
    try {
      await api(`/teaching/sessions/${id}`, { method: "DELETE" });
      show("Sesi berhasil diarsipkan.");
      router.replace(`/workspaces/${slug}/teaching/sessions`);
      router.refresh();
    } catch (reason) {
      show(
        reason instanceof Error ? reason.message : "Gagal mengarsipkan sesi.",
        "error",
      );
      setBusy(false);
    }
  }
  if (loadError)
    return (
      <div role="alert" className="error-box flex items-center justify-between gap-4">
        <span>{loadError}</span>
        <Button type="button" variant="secondary" onClick={() => setRetry((value) => value + 1)}>
          Coba lagi
        </Button>
      </div>
    );
  if (!session)
    return (
      <>
        <Skeleton className="h-10 w-80" />
        <Skeleton className="mt-7 h-64" />
      </>
    );
  const fmt = formatTeachingSessionSchedule(session);
  return (
    <>
      <Breadcrumb
        items={[
          { label: "Teaching", href: `/workspaces/${slug}/teaching` },
          { label: "Sessions", href: `/workspaces/${slug}/teaching/sessions` },
          { label: session.title },
        ]}
      />
      <PageHeader
        title={session.title}
        description={`${session.session_type || "Sesi pembelajaran"} · ${session.topic || "Topik belum diisi"}`}
        actions={
          <>
            <ButtonLink
              variant="secondary"
              href={`/workspaces/${slug}/teaching/sessions/${id}/edit`}
            >
              Edit sesi
            </ButtonLink>
            <Button variant="danger" onClick={() => setConfirm(true)}>
              Arsipkan
            </Button>
          </>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          <section className="surface p-6">
            <h2 className="font-serif text-xl text-primary">Deskripsi</h2>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[#50524f]">
              {session.description || "Belum ada deskripsi."}
            </p>
          </section>
          <section className="surface p-6">
            <h2 className="font-serif text-xl text-primary">
              Catatan fasilitator
            </h2>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[#50524f]">
              {session.notes || "Belum ada catatan."}
            </p>
          </section>
          <section className="surface p-6">
            <h2 className="font-serif text-xl text-primary">
              Materi & aktivitas
            </h2>
            <div className="mt-4 rounded-lg border border-dashed border-[#cfc7b8] p-8 text-center">
              <p className="text-sm font-medium text-primary">
                Belum ada materi yang ditautkan
              </p>
              <p className="mt-1 text-xs text-muted">
                Gunakan generator atau library untuk menambahkan bahan ajar.
              </p>
            </div>
          </section>
        </div>
        <aside className="surface h-fit p-5">
          <h2 className="font-serif text-lg text-primary">Metadata sesi</h2>
          <dl className="mt-4 space-y-4 text-sm">
            <div>
              <dt className="text-xs text-muted">Status</dt>
              <dd className="mt-1">
                <Badge
                  tone={teachingStatusTone(session.status)}
                >
                  {teachingStatusLabel(session.status)}
                </Badge>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Audiens</dt>
              <dd className="mt-1 font-medium">{session.audience || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Jadwal</dt>
              <dd className="mt-1 font-medium leading-5">{fmt}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Durasi</dt>
              <dd className="mt-1 font-medium">
                {session.duration_minutes
                  ? `${session.duration_minutes} menit`
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Dibuat</dt>
              <dd className="mt-1 font-medium">
                {session.created_at
                  ? new Intl.DateTimeFormat("id-ID", {
                      dateStyle: "medium",
                    }).format(new Date(session.created_at))
                  : "—"}
              </dd>
            </div>
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
        onConfirm={remove}
      />
    </>
  );
}

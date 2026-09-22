"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { Button, Input, Select, Textarea } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import {
  buildTeachingSessionPayload,
  type TeachingSessionFormValues,
} from "@/lib/resource-routes";
import { teachingStatusOptions } from "@/lib/teaching-status";
import type { TeachingActivity, TeachingSession, Workspace } from "@/lib/types";

const difficultyOptions = [
  { value: "", label: "Belum ditentukan" },
  { value: "beginner", label: "Pemula" },
  { value: "intermediate", label: "Menengah" },
  { value: "advanced", label: "Lanjutan" },
];

const sessionTypeOptions = [
  { value: "class", label: "Kelas" },
  { value: "workshop", label: "Lokakarya" },
  { value: "training", label: "Pelatihan" },
  { value: "bootcamp", label: "Bootcamp" },
  { value: "seminar", label: "Seminar" },
  { value: "mentoring", label: "Mentoring" },
  { value: "webinar", label: "Webinar" },
];

const modeOptions = [
  { value: "", label: "Belum ditentukan" },
  { value: "offline", label: "Tatap muka" },
  { value: "online", label: "Daring" },
  { value: "hybrid", label: "Hibrida" },
];

function initialValues(session?: TeachingSession): TeachingSessionFormValues {
  const firstActivity = session?.activities?.[0];
  const legacyDate = session?.scheduled_at?.slice(0, 10) ?? "";
  return {
    title: session?.title ?? "",
    session_type: firstActivity?.type ?? session?.session_type ?? "class",
    instructors: session?.instructors?.length
      ? session.instructors.join(", ")
      : session?.instructor ?? "",
    start_date: firstActivity?.startDate ?? session?.session_date ?? legacyDate,
    end_date: firstActivity?.endDate ?? session?.session_date ?? legacyDate,
    mode: session ? firstActivity?.mode ?? "" : "offline",
    status: session?.status === "archived" ? "draft" : session?.status ?? "draft",
    location: session?.location ?? "",
    participant_count: session?.participant_count ?? "",
    participant_label: session?.participant_label ?? "",
    audience: session?.audience ?? "",
    topic: session?.topic ?? "",
    difficulty: session?.difficulty ?? "",
    duration_minutes: session?.duration_minutes ?? "",
    description: session?.description ?? "",
    notes: session?.notes ?? "",
  };
}

export function SessionForm({ session }: { session?: TeachingSession }) {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const { show } = useToast();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [workspaceError, setWorkspaceError] = useState("");
  const [workspaceRetry, setWorkspaceRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<TeachingSessionFormValues>(() => initialValues(session));
  const additionalActivities: TeachingActivity[] = session?.activities?.slice(1) ?? [];

  useEffect(() => {
    if (session) return;
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setWorkspace(null);
      setWorkspaceError("");
    });
    api<Workspace>(`/workspaces/${slug}`)
      .then((value) => {
        if (active) setWorkspace(value);
      })
      .catch((reason) => {
        if (!active) return;
        setWorkspaceError(
          reason instanceof Error ? reason.message : "Ruang belum dapat dimuat.",
        );
      });
    return () => {
      active = false;
    };
  }, [session, slug, workspaceRetry]);

  const update = (key: keyof TeachingSessionFormValues, value: string | number) =>
    setForm((current) => ({ ...current, [key]: value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");

    if (!form.title.trim()) {
      setError("Judul wajib diisi.");
      return;
    }
    if (!form.instructors.split(",").some((value) => value.trim())) {
      setError("Isi setidaknya satu pengajar.");
      return;
    }
    if (!form.start_date || !form.end_date) {
      setError("Tanggal mulai dan tanggal selesai wajib diisi.");
      return;
    }
    if (form.end_date < form.start_date) {
      setError("Tanggal selesai tidak boleh sebelum tanggal mulai.");
      return;
    }

    setBusy(true);
    try {
      const body = buildTeachingSessionPayload(
        form,
        additionalActivities,
        session?.scheduled_at,
      );
      const saved = session
        ? await api<TeachingSession>(`/teaching/sessions/${session.id}`, {
            method: "PATCH",
            body: JSON.stringify(body),
          })
        : await api<TeachingSession>(
            `/workspaces/${workspace?.id ?? slug}/teaching/sessions`,
            { method: "POST", body: JSON.stringify(body) },
          );
      show(session ? "Sesi berhasil diperbarui." : "Sesi berhasil dibuat.");
      router.push(`/workspaces/${slug}/teaching-sessions/${saved.id}`);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Sesi gagal disimpan.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="surface p-5 sm:p-7">
      <div className="grid gap-5 md:grid-cols-2">
        <div className="md:col-span-2">
          <Input label="Judul" required value={form.title} onChange={(event) => update("title", event.target.value)} />
        </div>
        <Select
          label="Jenis sesi"
          required
          value={form.session_type}
          onChange={(event) => update("session_type", event.target.value)}
          options={sessionTypeOptions}
        />
        <Input
          label="Pengajar"
          required
          help="Pisahkan beberapa nama dengan koma."
          value={form.instructors}
          onChange={(event) => update("instructors", event.target.value)}
        />
        <Input label="Tanggal mulai" type="date" required value={form.start_date} onChange={(event) => update("start_date", event.target.value)} />
        <Input label="Tanggal selesai" type="date" required value={form.end_date} min={form.start_date || undefined} onChange={(event) => update("end_date", event.target.value)} />
        <Select label="Mode" value={form.mode} onChange={(event) => update("mode", event.target.value)} options={modeOptions} />
        <Select label="Status" value={form.status} onChange={(event) => update("status", event.target.value)} options={teachingStatusOptions} />
        <Input label="Lokasi" value={form.location} onChange={(event) => update("location", event.target.value)} placeholder="Ruang, gedung, atau tautan" />
        <Input label="Jumlah peserta" type="number" min={0} value={form.participant_count} onChange={(event) => update("participant_count", event.target.value)} />
        <Input label="Label peserta" value={form.participant_label} onChange={(event) => update("participant_label", event.target.value)} placeholder="Contoh: Mahasiswa semester 3" />
        <Input label="Audiens" value={form.audience} onChange={(event) => update("audience", event.target.value)} />
      </div>

      <details className="mt-6 border-t border-line pt-5">
        <summary className="cursor-pointer text-sm font-semibold text-primary">Detail opsional</summary>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <Input label="Topik" value={form.topic} onChange={(event) => update("topic", event.target.value)} />
          <Select label="Tingkat kesulitan" value={form.difficulty} onChange={(event) => update("difficulty", event.target.value)} options={difficultyOptions} />
          <Input label="Durasi (menit)" type="number" min={1} max={1440} value={form.duration_minutes} onChange={(event) => update("duration_minutes", event.target.value)} />
          <div className="md:col-span-2">
            <Textarea label="Deskripsi" value={form.description} onChange={(event) => update("description", event.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Textarea label="Catatan" value={form.notes} onChange={(event) => update("notes", event.target.value)} />
          </div>
        </div>
      </details>

      {workspaceError && (
        <div role="alert" className="error-box mt-5 flex items-center justify-between gap-4">
          <span>{workspaceError}</span>
          <Button type="button" variant="secondary" onClick={() => setWorkspaceRetry((value) => value + 1)}>
            Coba lagi
          </Button>
        </div>
      )}
      {error && <p role="alert" className="error-box mt-5">{error}</p>}
      <div className="mt-7 flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={() => router.back()}>Batal</Button>
        <Button disabled={busy || (!session && !workspace)} type="submit">
          {busy ? "Menyimpan…" : session ? "Simpan perubahan" : "Buat sesi"}
        </Button>
      </div>
    </form>
  );
}

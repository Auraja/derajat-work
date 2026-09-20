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
import type { TeachingSession, Workspace } from "@/lib/types";
import { teachingStatusOptions } from "@/lib/teaching-status";

const difficultyOptions = [
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
export function SessionForm({ session }: { session?: TeachingSession }) {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const { show } = useToast();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [workspaceError, setWorkspaceError] = useState("");
  const [workspaceRetry, setWorkspaceRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<TeachingSessionFormValues>({
    title: session?.title ?? "",
    topic: session?.topic ?? "",
    description: session?.description ?? "",
    audience: session?.audience ?? "",
    difficulty: session?.difficulty ?? "beginner",
    duration_minutes: session?.duration_minutes ?? 60,
    session_type: session?.session_type ?? "class",
    session_date: session?.session_date ?? "",
    status: session?.status ?? "draft",
    notes: session?.notes ?? "",
  });

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

  const update = (
    key: keyof TeachingSessionFormValues,
    value: string | number,
  ) => setForm((current) => ({ ...current, [key]: value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body = buildTeachingSessionPayload(form);
      const saved = session
        ? await api<TeachingSession>(`/teaching/sessions/${session.id}`, {
            method: "PATCH",
            body: JSON.stringify(body),
          })
        : await api<TeachingSession>(
            `/workspaces/${workspace?.id ?? slug}/teaching/sessions`,
            {
              method: "POST",
              body: JSON.stringify(body),
            },
          );
      show(session ? "Sesi berhasil diperbarui." : "Sesi berhasil dibuat.");
      router.push(`/workspaces/${slug}/teaching/sessions/${saved.id}`);
      router.refresh();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Sesi gagal disimpan.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="surface p-5 sm:p-7">
      <div className="grid gap-5 md:grid-cols-2">
        <div className="md:col-span-2">
          <Input
            label="Judul"
            required
            value={form.title}
            onChange={(e) => update("title", e.target.value)}
          />
        </div>
        <Input
          label="Topik"
          required
          value={form.topic}
          onChange={(e) => update("topic", e.target.value)}
        />
        <Input
          label="Audiens"
          required
          value={form.audience}
          onChange={(e) => update("audience", e.target.value)}
        />
        <Select
          label="Tingkat kesulitan"
          value={form.difficulty}
          onChange={(e) => update("difficulty", e.target.value)}
          options={difficultyOptions}
        />
        <Input
          label="Durasi (menit)"
          type="number"
          min={1}
          max={1440}
          required
          value={form.duration_minutes}
          onChange={(e) => update("duration_minutes", e.target.value)}
        />
        <Select
          label="Jenis sesi"
          value={form.session_type}
          onChange={(e) => update("session_type", e.target.value)}
          options={sessionTypeOptions}
        />
        <Input
          label="Tanggal sesi (opsional)"
          type="date"
          value={form.session_date}
          onChange={(e) => update("session_date", e.target.value)}
        />
        <Select
          label="Status"
          value={form.status}
          onChange={(e) => update("status", e.target.value)}
          options={teachingStatusOptions}
        />
        <div className="md:col-span-2">
          <Textarea
            label="Deskripsi"
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
          />
        </div>
        <div className="md:col-span-2">
          <Textarea
            label="Catatan"
            value={form.notes}
            onChange={(e) => update("notes", e.target.value)}
          />
        </div>
      </div>
      {workspaceError && (
        <div
          role="alert"
          className="mt-5 flex items-center justify-between gap-4 rounded-md border border-[#d8aaa5] bg-[#fff5f3] p-3 text-sm text-[#8d332c]"
        >
          <span>{workspaceError}</span>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setWorkspaceRetry((value) => value + 1)}
          >
            Coba lagi
          </Button>
        </div>
      )}
      {error && (
        <p
          role="alert"
          className="mt-5 rounded-md border border-[#d8aaa5] bg-[#fff5f3] p-3 text-sm text-[#8d332c]"
        >
          {error}
        </p>
      )}
      <div className="mt-7 flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={() => router.back()}>
          Batal
        </Button>
        <Button disabled={busy || (!session && !workspace)} type="submit">
          {busy ? "Menyimpan…" : session ? "Simpan perubahan" : "Buat sesi"}
        </Button>
      </div>
    </form>
  );
}

"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  ArrowPathRoundedSquareIcon,
  BoltIcon,
  CheckIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { api } from "@/lib/api";
import type { Orchestration, Skill, Workspace } from "@/lib/types";
import { Badge, Button, Empty, Input, Textarea } from "@/components/ui";
import { Dialog } from "@/components/ui/dialog";
import { ModalFrame } from "@/components/ui/modal-frame";
import { useToast } from "@/components/ui/toast";

function SkillForm({
  workspace,
  skill,
  onClose,
  onSaved,
}: {
  workspace: Workspace;
  skill?: Skill;
  onClose: () => void;
  onSaved: (skill: Skill) => void;
}) {
  const [form, setForm] = useState({
    name: skill?.name ?? "",
    description: skill?.description ?? "",
    instructions: skill?.instructions ?? "",
    is_enabled: skill?.is_enabled ?? true,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const saved = await api<Skill>(
        skill ? `/skills/${skill.id}` : `/workspaces/${workspace.id}/skills`,
        { method: skill ? "PATCH" : "POST", body: JSON.stringify(form) },
      );
      onSaved(saved);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Skill belum dapat disimpan.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <ModalFrame
      titleId="skill-editor-title"
      initialFocusSelector="input"
      onClose={onClose}
    >
      <div className="flex items-start justify-between gap-5">
        <div>
          <p className="eyebrow">Skill</p>
          <h2 id="skill-editor-title" className="editorial-title mt-2 text-3xl">
            {skill ? "Edit skill" : "Skill baru"}
          </h2>
        </div>
        <button type="button" className="icon-button" aria-label="Tutup" onClick={onClose}>
          <XMarkIcon className="h-5 w-5" />
        </button>
      </div>
      <form onSubmit={submit} className="mt-7 space-y-5">
        <Input
          label="Nama skill"
          required
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
        />
        <Textarea
          label="Deskripsi"
          value={form.description}
          onChange={(event) =>
            setForm({ ...form, description: event.target.value })
          }
        />
        <Textarea
          label="Instruksi"
          required
          help="Tuliskan cara kerja, standar hasil, dan batasan skill ini."
          className="min-h-44"
          value={form.instructions}
          onChange={(event) =>
            setForm({ ...form, instructions: event.target.value })
          }
        />
        <label className="flex items-center gap-3 text-sm text-primary">
          <input
            type="checkbox"
            checked={form.is_enabled}
            onChange={(event) =>
              setForm({ ...form, is_enabled: event.target.checked })
            }
          />
          Skill aktif
        </label>
        {error && (
          <p role="alert" className="error-box">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button
            disabled={busy || !form.name.trim() || !form.instructions.trim()}
          >
            {busy ? "Menyimpan…" : skill ? "Simpan perubahan" : "Simpan skill"}
          </Button>
        </div>
      </form>
    </ModalFrame>
  );
}

function OrchestrationForm({
  workspace,
  skills,
  orchestration,
  onClose,
  onSaved,
}: {
  workspace: Workspace;
  skills: Skill[];
  orchestration?: Orchestration;
  onClose: () => void;
  onSaved: (value: Orchestration) => void;
}) {
  const [form, setForm] = useState({
    name: orchestration?.name ?? "",
    description: orchestration?.description ?? "",
    skill_ids: orchestration?.steps.map((step) => Number(step.skill.id)) ?? [],
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const toggle = (id: number) =>
    setForm((current) => ({
      ...current,
      skill_ids: current.skill_ids.includes(id)
        ? current.skill_ids.filter((value) => value !== id)
        : [...current.skill_ids, id],
    }));
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const saved = await api<Orchestration>(
        orchestration
          ? `/orchestrations/${orchestration.id}`
          : `/workspaces/${workspace.id}/orchestrations`,
        {
          method: orchestration ? "PATCH" : "POST",
          body: JSON.stringify(form),
        },
      );
      onSaved(saved);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Rangkaian belum dapat disimpan.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <ModalFrame
      titleId="orchestration-editor-title"
      initialFocusSelector="input"
      onClose={onClose}
    >
      <div className="flex items-start justify-between gap-5">
        <div>
          <p className="eyebrow">Orkestrasi</p>
          <h2 id="orchestration-editor-title" className="editorial-title mt-2 text-3xl">
            {orchestration ? "Edit rangkaian" : "Rangkaian baru"}
          </h2>
        </div>
        <button type="button" className="icon-button" aria-label="Tutup" onClick={onClose}>
          <XMarkIcon className="h-5 w-5" />
        </button>
      </div>
      <form onSubmit={submit} className="mt-7 space-y-5">
        <Input
          label="Nama rangkaian"
          required
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
        />
        <Textarea
          label="Deskripsi"
          value={form.description}
          onChange={(event) =>
            setForm({ ...form, description: event.target.value })
          }
        />
        <fieldset>
          <legend className="label">Urutan skill</legend>
          <p className="help mb-3">
            Pilih sesuai urutan eksekusi. Nomor menunjukkan posisi dalam
            rangkaian.
          </p>
          <div className="space-y-2">
            {skills.map((skill) => {
              const position = form.skill_ids.indexOf(Number(skill.id));
              return (
                <label
                  key={skill.id}
                  className={`skill-choice ${position >= 0 ? "selected" : ""}`}
                >
                  <input
                    className="sr-only"
                    type="checkbox"
                    aria-label={skill.name}
                    checked={position >= 0}
                    onChange={() => toggle(Number(skill.id))}
                  />
                  <span className="skill-choice-number">
                    {position >= 0 ? (
                      position + 1
                    ) : (
                      <CheckIcon className="h-3.5 w-3.5 opacity-30" />
                    )}
                  </span>
                  <span>
                    <strong>{skill.name}</strong>
                    <small>{skill.description || "Tanpa deskripsi"}</small>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
        {error && (
          <p role="alert" className="error-box">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button disabled={busy || !form.name.trim()}>
            {busy
              ? "Menyimpan…"
              : orchestration
                ? "Simpan perubahan"
                : "Simpan rangkaian"}
          </Button>
        </div>
      </form>
    </ModalFrame>
  );
}

export function SkillsStudio({ workspace }: { workspace: Workspace }) {
  const [skills, setSkills] = useState<Skill[] | null>(null);
  const [orchestrations, setOrchestrations] = useState<Orchestration[] | null>(
    null,
  );
  const [skillEditor, setSkillEditor] = useState<Skill | null | undefined>(
    undefined,
  );
  const [flowEditor, setFlowEditor] = useState<
    Orchestration | null | undefined
  >(undefined);
  const [deleting, setDeleting] = useState<{
    kind: "skill" | "orchestration";
    id: number;
    name: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState("");
  const { show } = useToast();
  const fetchStudio = useCallback(
    () =>
      Promise.all([
        api<Skill[]>(`/workspaces/${workspace.id}/skills`),
        api<Orchestration[]>(`/workspaces/${workspace.id}/orchestrations`),
      ]),
    [workspace.id],
  );
  const load = useCallback(async () => {
    try {
      const [skillRows, flowRows] = await fetchStudio();
      setLoadError("");
      setSkills(skillRows);
      setOrchestrations(flowRows);
    } catch (reason) {
      setSkills([]);
      setOrchestrations([]);
      setLoadError(
        reason instanceof Error
          ? reason.message
          : "Studio skills belum dapat dimuat.",
      );
    }
  }, [fetchStudio]);
  useEffect(() => {
    let active = true;
    void fetchStudio()
      .then(([skillRows, flowRows]) => {
        if (!active) return;
        setLoadError("");
        setSkills(skillRows);
        setOrchestrations(flowRows);
      })
      .catch((reason) => {
        if (!active) return;
        setSkills([]);
        setOrchestrations([]);
        setLoadError(
          reason instanceof Error
            ? reason.message
            : "Studio skills belum dapat dimuat.",
        );
      });
    return () => {
      active = false;
    };
  }, [fetchStudio]);
  const saveSkill = (saved: Skill) => {
    setSkills((current) => {
      const rows = current ?? [];
      return rows.some((item) => item.id === saved.id)
        ? rows.map((item) => (item.id === saved.id ? saved : item))
        : [...rows, saved];
    });
    setSkillEditor(undefined);
    show("Skill tersimpan.");
  };
  const saveFlow = (saved: Orchestration) => {
    setOrchestrations((current) => {
      const rows = current ?? [];
      return rows.some((item) => item.id === saved.id)
        ? rows.map((item) => (item.id === saved.id ? saved : item))
        : [...rows, saved];
    });
    setFlowEditor(undefined);
    show("Rangkaian tersimpan.");
  };
  async function remove() {
    if (!deleting) return;
    setBusy(true);
    try {
      await api(
        `/${deleting.kind === "skill" ? "skills" : "orchestrations"}/${deleting.id}`,
        { method: "DELETE" },
      );
      if (deleting.kind === "skill") {
        setSkills((current) =>
          (current ?? []).filter((item) => Number(item.id) !== deleting.id),
        );
        await load();
      } else
        setOrchestrations((current) =>
          (current ?? []).filter((item) => Number(item.id) !== deleting.id),
        );
      show("Item telah dihapus.", "info");
      setDeleting(null);
    } catch (reason) {
      show(
        reason instanceof Error ? reason.message : "Item belum dapat dihapus.",
        "error",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div id="skills" className="space-y-12">
      {loadError && (
        <div
          role="alert"
          className="error-box flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center"
        >
          <span>{loadError}</span>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setLoadError("");
              setSkills(null);
              setOrchestrations(null);
              void load();
            }}
          >
            Coba lagi
          </Button>
        </div>
      )}
      <section aria-labelledby="skills-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Kemampuan tersimpan</p>
            <h2 id="skills-heading" className="editorial-title mt-2 text-3xl">
              Skills pribadi
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              Simpan cara kerja yang ingin Anda gunakan berulang kali—sebagai
              aset pribadi, bukan katalog institusi.
            </p>
          </div>
          <Button onClick={() => setSkillEditor(null)}>
            <PlusIcon className="h-4 w-4" />
            Skill baru
          </Button>
        </div>
        {skills === null ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="surface h-40 animate-pulse" />
            <div className="surface h-40 animate-pulse" />
          </div>
        ) : skills.length === 0 ? (
          <Empty
            title="Belum ada skill"
            description="Mulai dengan satu cara kerja yang sering Anda ulang—riset, menulis, mengajar, atau merapikan dokumen."
            action={
              <Button onClick={() => setSkillEditor(null)}>
                Buat skill pertama
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {skills.map((skill) => (
              <article key={skill.id} className="skill-card">
                <div className="flex items-center justify-between">
                  <span className="skill-glyph">
                    <BoltIcon className="h-4 w-4" />
                  </span>
                  <Badge tone={skill.is_enabled ? "good" : "neutral"}>
                    {skill.is_enabled ? "Aktif" : "Jeda"}
                  </Badge>
                </div>
                <h3 className="editorial-title mt-5 text-xl">{skill.name}</h3>
                <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-muted">
                  {skill.description || "Skill pribadi siap dirangkai."}
                </p>
                <div className="mt-5 flex justify-end gap-1 border-t border-line pt-3">
                  <button
                    className="icon-button"
                    aria-label={`Edit ${skill.name}`}
                    onClick={() => setSkillEditor(skill)}
                  >
                    <PencilSquareIcon className="h-4 w-4" />
                  </button>
                  <button
                    className="icon-button danger-icon"
                    aria-label={`Hapus ${skill.name}`}
                    onClick={() =>
                      setDeleting({
                        kind: "skill",
                        id: Number(skill.id),
                        name: skill.name,
                      })
                    }
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      <section aria-labelledby="orchestration-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Alur berurutan</p>
            <h2
              id="orchestration-heading"
              className="editorial-title mt-2 text-3xl"
            >
              Rangkaian skills
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              Susun beberapa skill menjadi urutan kerja yang dapat dihubungkan
              ke runtime AI saat eksekusi tersedia.
            </p>
          </div>
          <Button
            variant="secondary"
            disabled={!skills?.length}
            onClick={() => setFlowEditor(null)}
          >
            <ArrowPathRoundedSquareIcon className="h-4 w-4" />
            Rangkaian baru
          </Button>
        </div>
        {orchestrations === null ? (
          <div className="surface h-36 animate-pulse" />
        ) : orchestrations.length === 0 ? (
          <div className="orchestration-empty">
            <p className="editorial-title text-xl">Belum ada rangkaian</p>
            <p className="mt-2 text-sm text-muted">
              Pilih beberapa skill dan simpan urutannya. Tidak ada eksekusi
              semu—bagian ini menyimpan desain orkestrasi secara nyata.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {orchestrations.map((flow) => (
              <article key={flow.id} className="orchestration-card">
                <div className="min-w-0">
                  <h3 className="editorial-title text-xl">{flow.name}</h3>
                  <p className="mt-1 text-sm text-muted">
                    {flow.description || "Rangkaian kerja tersimpan."}
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {flow.steps.length === 0 ? (
                      <span className="text-xs text-muted">
                        Belum ada langkah
                      </span>
                    ) : (
                      flow.steps.map((step, index) => (
                        <span key={step.skill.id} className="sequence-chip">
                          <b>{index + 1}</b>
                          {step.skill.name}
                        </span>
                      ))
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    className="icon-button"
                    aria-label={`Edit ${flow.name}`}
                    onClick={() => setFlowEditor(flow)}
                  >
                    <PencilSquareIcon className="h-4 w-4" />
                  </button>
                  <button
                    className="icon-button danger-icon"
                    aria-label={`Hapus ${flow.name}`}
                    onClick={() =>
                      setDeleting({
                        kind: "orchestration",
                        id: Number(flow.id),
                        name: flow.name,
                      })
                    }
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      {skillEditor !== undefined && (
        <SkillForm
          workspace={workspace}
          skill={skillEditor ?? undefined}
          onClose={() => setSkillEditor(undefined)}
          onSaved={saveSkill}
        />
      )}{" "}
      {flowEditor !== undefined && skills && (
        <OrchestrationForm
          workspace={workspace}
          skills={skills.filter((skill) => skill.is_enabled)}
          orchestration={flowEditor ?? undefined}
          onClose={() => setFlowEditor(undefined)}
          onSaved={saveFlow}
        />
      )}
      <Dialog
        open={Boolean(deleting)}
        title={`Hapus ${deleting?.kind === "skill" ? "skill" : "rangkaian"}?`}
        description={`“${deleting?.name ?? "Item"}” akan dihapus permanen.`}
        confirmLabel="Hapus"
        busy={busy}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
      />
    </div>
  );
}

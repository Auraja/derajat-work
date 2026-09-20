"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  BookmarkSquareIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { api } from "@/lib/api";
import type { Workspace } from "@/lib/types";
import { Button, Empty, Input, Textarea } from "@/components/ui";
import { Dialog } from "@/components/ui/dialog";
import { ModalFrame } from "@/components/ui/modal-frame";
import { useToast } from "@/components/ui/toast";

export const WORKSPACES_CHANGED_EVENT = "derajat:workspaces-changed";

type ChangeAction = "created" | "updated" | "deleted";
type Props = {
  workspaces: Workspace[];
  onChange: (workspace: Workspace, action: ChangeAction) => void;
};

function FormModal({
  workspace,
  onClose,
  onSaved,
}: {
  workspace?: Workspace;
  onClose: () => void;
  onSaved: (workspace: Workspace) => void;
}) {
  const [form, setForm] = useState({
    name: workspace?.name ?? "",
    description: workspace?.description ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body = workspace
        ? { name: form.name, description: form.description }
        : {
            name: form.name,
            description: form.description,
            workspace_type: "personal",
          };
      const saved = await api<Workspace>(
        workspace ? `/workspaces/${workspace.id}` : "/workspaces",
        {
          method: workspace ? "PATCH" : "POST",
          body: JSON.stringify(body),
        },
      );
      onSaved(saved);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Ruang belum dapat disimpan.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalFrame
      titleId="workspace-form-title"
      initialFocusSelector="input"
      onClose={onClose}
    >
      <div className="flex items-start justify-between gap-5">
        <div>
          <p className="eyebrow">Ruang pribadi</p>
          <h2
            id="workspace-form-title"
            className="editorial-title mt-2 text-3xl"
          >
            {workspace ? "Edit ruang" : "Ruang baru"}
          </h2>
        </div>
        <button
          type="button"
          className="icon-button"
          aria-label="Tutup"
          onClick={onClose}
        >
          <XMarkIcon className="h-5 w-5" />
        </button>
      </div>
      <form onSubmit={submit} className="mt-7 space-y-5">
        <Input
          label="Nama ruang"
          required
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
        />
        <Textarea
          label="Deskripsi"
          help="Satu kalimat yang mengingatkan fungsi ruang ini."
          value={form.description}
          onChange={(event) =>
            setForm({ ...form, description: event.target.value })
          }
        />
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
              : workspace
                ? "Simpan perubahan"
                : "Simpan ruang"}
          </Button>
        </div>
      </form>
    </ModalFrame>
  );
}

export function WorkspaceCollection({ workspaces, onChange }: Props) {
  const [editing, setEditing] = useState<Workspace | null | undefined>(
    undefined,
  );
  const [deleting, setDeleting] = useState<Workspace | null>(null);
  const [busy, setBusy] = useState(false);
  const { show } = useToast();

  function changed(workspace: Workspace, action: ChangeAction) {
    setEditing(undefined);
    onChange(workspace, action);
    window.dispatchEvent(new Event(WORKSPACES_CHANGED_EVENT));
    show(
      action === "created"
        ? "Ruang baru siap digunakan."
        : "Perubahan ruang tersimpan.",
    );
  }

  async function remove() {
    if (!deleting) return;
    setBusy(true);
    try {
      await api(`/workspaces/${deleting.id}`, { method: "DELETE" });
      onChange(deleting, "deleted");
      window.dispatchEvent(new Event(WORKSPACES_CHANGED_EVENT));
      show("Ruang telah dihapus.", "info");
      setDeleting(null);
    } catch (reason) {
      show(
        reason instanceof Error ? reason.message : "Ruang belum dapat dihapus.",
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="workspace-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Koleksi kerja</p>
          <h2 id="workspace-heading" className="editorial-title mt-2 text-3xl">
            Ruang pilihan Anda
          </h2>
          <p className="mt-2 text-sm text-muted">
            Pisahkan konteks, bukan identitas. Semua ruang ini hanya untuk Anda.
          </p>
        </div>
        <Button onClick={() => setEditing(null)}>
          <PlusIcon className="h-4 w-4" />
          Ruang baru
        </Button>
      </div>
      {workspaces.length === 0 ? (
        <Empty
          title="Mulai dari satu ruang"
          description="Buat ruang pribadi pertama untuk menyimpan pekerjaan dan ide yang sedang Anda rawat."
          action={<Button onClick={() => setEditing(null)}>Buat ruang</Button>}
        />
      ) : (
        <div className="workspace-grid">
          {workspaces.map((workspace, index) => (
            <article key={workspace.id} className="workspace-card group">
              <div className="flex items-start justify-between gap-4">
                <span className="workspace-index">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="private-mark">Pribadi</span>
              </div>
              <div className="mt-9">
                <BookmarkSquareIcon className="h-6 w-6 text-accent" />
                <h3 className="editorial-title mt-4 text-2xl">
                  {workspace.name}
                </h3>
                <p className="mt-3 min-h-12 text-sm leading-6 text-muted">
                  {workspace.description ||
                    "Ruang tenang untuk menyimpan pekerjaan, pengetahuan, dan proses Anda."}
                </p>
              </div>
              <div className="mt-7 flex items-center justify-between border-t border-line pt-4">
                <Link
                  href={`/workspaces/${workspace.slug}`}
                  className="quiet-link"
                >
                  Buka ruang <ArrowRightIcon className="h-4 w-4" />
                </Link>
                {workspace.role === "owner" && (
                  <div className="flex gap-1">
                    <button
                      className="icon-button"
                      aria-label={`Edit ${workspace.name}`}
                      onClick={() => setEditing(workspace)}
                    >
                      <PencilSquareIcon className="h-4 w-4" />
                    </button>
                    <button
                      className="icon-button danger-icon"
                      aria-label={`Hapus ${workspace.name}`}
                      onClick={() => setDeleting(workspace)}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      {editing !== undefined && (
        <FormModal
          workspace={editing ?? undefined}
          onClose={() => setEditing(undefined)}
          onSaved={(saved) => changed(saved, editing ? "updated" : "created")}
        />
      )}
      <Dialog
        open={Boolean(deleting)}
        title="Hapus ruang?"
        description={`“${deleting?.name ?? "Ruang"}” beserta seluruh isi di dalamnya akan dihapus permanen.`}
        confirmLabel="Hapus ruang"
        busy={busy}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
      />
    </section>
  );
}

"use client";

import {
  ArrowRightIcon,
  BookOpenIcon,
  FolderIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { WORKSPACES_CHANGED_EVENT } from "@/components/workspace-collection";
import { SkillsStudio } from "@/components/skills-studio";
import { Breadcrumb, Button, PageHeader, Skeleton } from "@/components/ui";
import { api, jsonBody } from "@/lib/api";
import type { Module, Workspace } from "@/lib/types";

const moduleLabels: Record<string, string> = {
  teaching: "Mengajar",
  files: "Berkas",
  documents: "Dokumen",
  projects: "Proyek",
  research: "Riset",
  notes: "Catatan",
  clients: "Klien",
};

export default function WorkspaceOverview() {
  const { slug } = useParams<{ slug: string }>();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [error, setError] = useState("");
  const [moduleName, setModuleName] = useState("");
  const [moduleError, setModuleError] = useState("");

  const fetchWorkspace = useCallback(
    () => api<Workspace>(`/workspaces/${slug}`),
    [slug],
  );

  const load = useCallback(async () => {
    try {
      const value = await fetchWorkspace();
      setError("");
      setWorkspace(value);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Ruang belum dapat dimuat.");
    }
  }, [fetchWorkspace]);

  useEffect(() => {
    let active = true;
    void fetchWorkspace()
      .then((value) => {
        if (!active) return;
        setError("");
        setWorkspace(value);
      })
      .catch((reason) => {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : "Ruang belum dapat dimuat.");
      });
    return () => {
      active = false;
    };
  }, [fetchWorkspace]);

  function retry() {
    setError("");
    setWorkspace(null);
    void load();
  }

  async function addModule(event: FormEvent) {
    event.preventDefault();
    if (!workspace || !moduleName.trim()) return;
    try {
      const createdModule = await api<Module>(`/workspaces/${workspace.id}/modules`, { method: "POST", ...jsonBody({ name: moduleName }) });
      setWorkspace({ ...workspace, modules: [...(workspace.modules ?? []), createdModule] });
      setModuleName(""); setModuleError("");
      window.dispatchEvent(new Event(WORKSPACES_CHANGED_EVENT));
    } catch (reason) { setModuleError(reason instanceof Error ? reason.message : "Menu gagal ditambahkan."); }
  }

  async function removeModule(module: Module) {
    if (!workspace || !window.confirm(`Hapus menu “${moduleLabels[module.slug] ?? module.name}”? Data terkait tidak akan dihapus.`)) return;
    try {
      await api(`/workspaces/${workspace.id}/modules/${module.id}`, { method: "DELETE" });
      setWorkspace({ ...workspace, modules: (workspace.modules ?? []).filter((item) => item.id !== module.id) });
      setModuleError(""); window.dispatchEvent(new Event(WORKSPACES_CHANGED_EVENT));
    } catch (reason) { setModuleError(reason instanceof Error ? reason.message : "Menu gagal dihapus."); }
  }

  if (error) {
    return (
      <section role="alert" className="surface max-w-2xl p-7">
        <p className="eyebrow">Ruang tidak tersedia</p>
        <h1 className="editorial-title mt-3 text-3xl">Kami belum dapat membuka ruang ini.</h1>
        <p className="mt-3 text-sm leading-6 text-muted">{error}</p>
        <Button className="mt-6" onClick={retry}>Coba lagi</Button>
      </section>
    );
  }

  if (!workspace) {
    return (
      <>
        <Skeleton className="h-10 w-72" />
        <Skeleton className="mt-7 h-72" />
      </>
    );
  }

  return (
    <div className="space-y-14">
      <div>
        <Breadcrumb items={[{ label: "Beranda", href: "/dashboard" }, { label: workspace.name }]} />
        <PageHeader
          eyebrow="Ruang pilihan"
          title={workspace.name}
          description={
            workspace.description ||
            "Pusat pekerjaan, pengetahuan, dan cara kerja yang Anda pilih sendiri."
          }
        />
      </div>
      <section aria-labelledby="modules-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Area kerja</p>
            <h2 id="modules-heading" className="editorial-title mt-2 text-3xl">Modul</h2>
          </div>
          <span className="private-mark">{workspace.modules?.length ?? 0} aktif</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {(workspace.modules ?? []).map((module, index) => {
            const Icon = module.slug === "teaching" ? BookOpenIcon : FolderIcon;
            return (
              <Link
                key={module.id}
                href={`/workspaces/${slug}/${module.slug}`}
                className="module-card group"
              >
                <div className="flex items-start justify-between">
                  <span className="module-icon"><Icon className="h-5 w-5" /></span>
                  <span className="workspace-index">{String(index + 1).padStart(2, "0")}</span>
                </div>
                <h3 className="editorial-title mt-8 text-2xl">
                  {moduleLabels[module.slug] ?? module.name}
                </h3>
                <p className="mt-3 min-h-12 text-sm leading-6 text-muted">
                  {module.description || "Buka area ini untuk melanjutkan pekerjaan yang tersimpan."}
                </p>
                <span className="quiet-link mt-6">
                  Buka modul
                  <ArrowRightIcon className="h-4 w-4 transition group-hover:translate-x-1" />
                </span>
              </Link>
            );
          })}
          <a href="#skills" className="module-card module-card-accent group">
            <div className="flex items-start justify-between">
              <span className="module-icon"><SparklesIcon className="h-5 w-5" /></span>
              <span className="private-mark">Baru</span>
            </div>
            <h3 className="editorial-title mt-8 text-2xl">Skills & Rangkaian</h3>
            <p className="mt-3 min-h-12 text-sm leading-6 text-muted">
              Bangun cara kerja pribadi, lalu susun urutannya menjadi rangkaian yang dapat digunakan kembali.
            </p>
            <span className="quiet-link mt-6">
              Kelola skills
              <ArrowRightIcon className="h-4 w-4 transition group-hover:translate-x-1" />
            </span>
          </a>
        </div>
      </section>
      {(workspace.role === "owner" || workspace.role === "admin") && (
        <section className="surface p-5 sm:p-7" aria-labelledby="module-settings-heading">
          <p className="eyebrow">Pengaturan sidebar</p>
          <h2 id="module-settings-heading" className="editorial-title mt-2 text-3xl">Atur menu workspace</h2>
          <p className="mt-2 text-sm leading-6 text-muted">Tambah atau hapus menu. Menu yang memiliki data tidak dapat dihapus sebelum datanya dipindahkan atau dibersihkan.</p>
          {moduleError && <p role="alert" className="error-box mt-4">{moduleError}</p>}
          <form onSubmit={addModule} className="mt-5 flex flex-col gap-2 sm:flex-row">
            <label className="sr-only" htmlFor="module-name">Nama menu baru</label>
            <input id="module-name" className="control sm:max-w-sm" value={moduleName} onChange={(event) => setModuleName(event.target.value)} placeholder="Contoh: Klien" />
            <Button type="submit">Tambah menu</Button>
          </form>
          <ul className="mt-5 divide-y divide-line">
            {(workspace.modules ?? []).map((module) => <li key={module.id} className="flex items-center justify-between gap-4 py-3"><span>{moduleLabels[module.slug] ?? module.name}</span><Button variant="ghost" onClick={() => removeModule(module)}>Hapus menu</Button></li>)}
          </ul>
        </section>
      )}
      <div className="ornament-divider" aria-hidden><span>✦</span></div>
      <SkillsStudio workspace={workspace} />
    </div>
  );
}

"use client";

import {
  ArrowRightIcon,
  BoltIcon,
  ClockIcon,
  RectangleStackIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { WorkspaceCollection } from "@/components/workspace-collection";
import { Button, ButtonLink, Skeleton } from "@/components/ui";
import { api } from "@/lib/api";
import { normalizePagination } from "@/lib/pagination";
import { materialCollectionPath } from "@/lib/resource-routes";
import type { Material, TeachingSession, User, Workspace } from "@/lib/types";

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[] | null>(null);
  const [sessionTotal, setSessionTotal] = useState(0);
  const [materialTotal, setMaterialTotal] = useState(0);
  const [loadError, setLoadError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setLoadError("");
      setWorkspaces(null);
    });

    void Promise.all([api<User>("/auth/me"), api<Workspace[]>("/workspaces")])
      .then(async ([currentUser, workspaceItems]) => {
        if (!active) return;
        const available = Array.isArray(workspaceItems) ? workspaceItems : [];
        setUser(currentUser);
        setWorkspaces(available);

        const focus =
          available.find((item) => item.slug === "bisa-ai") ?? available[0];
        if (!focus) {
          setSessionTotal(0);
          setMaterialTotal(0);
          return;
        }

        const [sessionResult, materialResult] = await Promise.allSettled([
          api<unknown>(`/workspaces/${focus.id}/teaching/sessions?page_size=5`),
          api<unknown>(`${materialCollectionPath(focus.id)}&page_size=5`),
        ]);
        if (!active) return;
        setSessionTotal(
          sessionResult.status === "fulfilled"
            ? normalizePagination<TeachingSession>(sessionResult.value).total
            : 0,
        );
        setMaterialTotal(
          materialResult.status === "fulfilled"
            ? normalizePagination<Material>(materialResult.value).total
            : 0,
        );
      })
      .catch((reason) => {
        if (!active) return;
        setLoadError(
          reason instanceof Error ? reason.message : "Dasbor belum dapat dimuat.",
        );
      });

    return () => {
      active = false;
    };
  }, [retry]);

  const focus = useMemo(
    () =>
      workspaces?.find((item) => item.slug === "bisa-ai") ?? workspaces?.[0],
    [workspaces],
  );
  const firstName = user?.name?.trim().split(/\s+/)[0] ?? "Anda";
  const today = new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  function updateWorkspace(
    workspace: Workspace,
    action: "created" | "updated" | "deleted",
  ) {
    setWorkspaces((current) => {
      const rows = current ?? [];
      if (action === "created") return [...rows, workspace];
      if (action === "deleted") {
        return rows.filter((item) => item.id !== workspace.id);
      }
      return rows.map((item) => (item.id === workspace.id ? workspace : item));
    });
  }

  return (
    <div className="space-y-14">
      <section className="dashboard-hero">
        <div className="relative z-10 max-w-3xl">
          <p className="eyebrow text-[#cbb38f]">{today}</p>
          <h1 className="mt-5 font-serif text-4xl leading-[1.08] tracking-[-.035em] text-[#fffaf0] sm:text-5xl lg:text-6xl">
            Selamat datang, {firstName}.
          </h1>
          <p className="mt-5 max-w-2xl text-sm leading-7 text-[#d8d0c3] sm:text-base">
            Ini ruang kerja pribadi Anda—tenang, terarah, dan hanya berisi hal
            yang layak mendapat perhatian.
          </p>
          {focus && (
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href={`/workspaces/${focus.slug}`}>
                Lanjut ke {focus.name}
              </ButtonLink>
              <ButtonLink
                href={`/workspaces/${focus.slug}#skills`}
                variant="ghost"
                className="border-[#665b4c] text-[#f7efe2] hover:bg-white/5"
              >
                Kelola skills
              </ButtonLink>
            </div>
          )}
        </div>
        <div aria-hidden className="hero-monogram">
          D
        </div>
      </section>

      {loadError && (
        <div role="alert" className="error-box flex items-center justify-between gap-4">
          <span>{loadError}</span>
          <Button type="button" variant="secondary" onClick={() => setRetry((value) => value + 1)}>
            Coba lagi
          </Button>
        </div>
      )}

      <Link href="/kanban" className="surface group block p-7 sm:p-9">
        <p className="eyebrow">Area utama</p>
        <div className="mt-3 flex items-center justify-between gap-4">
          <div>
            <h2 className="editorial-title text-3xl">Kanban global</h2>
            <p className="mt-2 text-sm leading-6 text-muted">Kelola dan delegasikan seluruh tugas lintas workspace/PT dari satu papan.</p>
          </div>
          <ArrowRightIcon className="h-6 w-6 shrink-0 transition-transform group-hover:translate-x-1" />
        </div>
      </Link>

      <section className="grid gap-px overflow-hidden border border-line bg-line sm:grid-cols-3">
        {[
          {
            label: "Ruang aktif",
            value: workspaces?.length ?? "—",
            icon: RectangleStackIcon,
          },
          {
            label: "Sesi di PT BISA AI",
            value: sessionTotal,
            icon: ClockIcon,
          },
          {
            label: "Materi tersimpan",
            value: materialTotal,
            icon: BoltIcon,
          },
        ].map((item) => (
          <div key={item.label} className="metric-cell">
            <item.icon className="h-5 w-5 text-accent" />
            <p className="mt-7 font-serif text-4xl text-primary">{item.value}</p>
            <p className="mt-1 text-xs tracking-wide text-muted">{item.label}</p>
          </div>
        ))}
      </section>

      {loadError ? null : workspaces === null ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      ) : (
        <WorkspaceCollection workspaces={workspaces} onChange={updateWorkspace} />
      )}

      {focus && (
        <aside className="focus-strip">
          <div>
            <p className="eyebrow">Fokus utama</p>
            <h2 className="editorial-title mt-2 text-3xl">{focus.name}</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
              Masuk langsung ke Teaching, susun skill pribadi, atau lanjutkan
              materi terakhir tanpa melewati menu yang tidak perlu.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className="quiet-link" href={`/workspaces/${focus.slug}/teaching`}>
              Buka Teaching <ArrowRightIcon className="h-4 w-4" />
            </Link>
            <Link className="quiet-link" href={`/workspaces/${focus.slug}#skills`}>
              Buka Skills <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </div>
        </aside>
      )}
    </div>
  );
}

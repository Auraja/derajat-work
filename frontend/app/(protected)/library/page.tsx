"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Material, Workspace } from "@/lib/types";
import { materialCollectionPath } from "@/lib/resource-routes";
import { normalizePagination } from "@/lib/pagination";
import { Badge, Button, Empty, Input, PageHeader, Skeleton } from "@/components/ui";

const pageSize = 100;
type LibraryMaterial = Material & { workspaceSlug: string };

async function fetchWorkspaceMaterials(workspace: Workspace) {
  const path = materialCollectionPath(workspace.id);
  const first = normalizePagination<Material>(
    await api<unknown>(`${path}&page=1&page_size=${pageSize}`),
  );
  if (first.pages <= 1) {
    return first.items.map((item) => ({ ...item, workspaceSlug: workspace.slug }));
  }

  const remaining = await Promise.all(
    Array.from({ length: first.pages - 1 }, (_, index) =>
      api<unknown>(`${path}&page=${index + 2}&page_size=${pageSize}`).then(
        (value) => normalizePagination<Material>(value).items,
      ),
    ),
  );
  return [...first.items, ...remaining.flat()].map((item) => ({
    ...item,
    workspaceSlug: workspace.slug,
  }));
}

export default function LibraryPage() {
  const [rows, setRows] = useState<LibraryMaterial[] | null>(null);
  const [search, setSearch] = useState("");
  const [loadError, setLoadError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setRows(null);
      setLoadError("");
    });
    api<Workspace[]>("/workspaces")
      .then(async (workspaces) => {
        const results = await Promise.allSettled(
          workspaces.map(fetchWorkspaceMaterials),
        );
        const failed = results.find(
          (result): result is PromiseRejectedResult => result.status === "rejected",
        );
        if (failed) {
          if (active) {
            setLoadError(
              failed.reason instanceof Error
                ? failed.reason.message
                : "Pustaka belum dapat dimuat.",
            );
          }
          return;
        }
        if (active) {
          setRows(
            results.flatMap((result) =>
              result.status === "fulfilled" ? result.value : [],
            ),
          );
        }
      })
      .catch((reason) => {
        if (!active) return;
        setLoadError(
          reason instanceof Error ? reason.message : "Pustaka belum dapat dimuat.",
        );
      });
    return () => {
      active = false;
    };
  }, [retry]);

  const filtered = (rows ?? []).filter((item) =>
    `${item.title} ${item.description ?? ""} ${(item.tags ?? []).join(" ")}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  return (
    <>
      <PageHeader
        title="Pustaka global"
        description="Temukan materi dari seluruh workspace yang dapat Anda akses."
      />
      <div className="mb-6 max-w-xl">
        <Input
          aria-label="Cari pustaka"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Cari judul, deskripsi, atau tag…"
        />
      </div>
      {loadError ? (
        <div role="alert" className="error-box flex items-center justify-between gap-4">
          <span>{loadError}</span>
          <Button type="button" variant="secondary" onClick={() => setRetry((value) => value + 1)}>
            Coba lagi
          </Button>
        </div>
      ) : rows === null ? (
        <Skeleton className="h-64" />
      ) : filtered.length === 0 ? (
        <Empty
          title="Pustaka masih kosong"
          description="Materi dari workspace Anda akan terkumpul di sini."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((item) => (
            <article key={item.id} className="surface min-w-0 p-5">
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-serif text-xl text-primary">
                  <Link
                    className="hover:underline"
                    href={`/workspaces/${item.workspaceSlug}/materials/${item.id}`}
                  >
                    {item.title}
                  </Link>
                </h2>
                <Badge tone="info">{item.material_type ?? "material"}</Badge>
              </div>
              <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted">
                {item.description || item.content || "Tidak ada deskripsi."}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {item.tags?.map((tag) => <Badge key={tag}>{tag}</Badge>)}
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}

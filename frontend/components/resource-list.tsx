"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { api } from "@/lib/api";
import { normalizePagination } from "@/lib/pagination";
import {
  materialCollectionPath,
  templateCollectionPath,
} from "@/lib/resource-routes";
import type { Material, Template, Workspace } from "@/lib/types";
import {
  Badge,
  Breadcrumb,
  Button,
  ButtonLink,
  Empty,
  Input,
  PageHeader,
  Pagination,
  ResponsiveTable,
  Skeleton,
} from "@/components/ui";

type Props = {
  kind: "materials" | "templates";
  workspace?: Workspace;
  global?: boolean;
};

const PAGE_SIZE = 20;

function withPage(path: string, page: number): string {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}page=${page}&page_size=${PAGE_SIZE}`;
}

function withSearch(path: string, search: string): string {
  return search ? `${path}&search=${encodeURIComponent(search)}` : path;
}

export function ResourceList({
  kind,
  workspace,
  global: globalView = false,
}: Props) {
  const [rows, setRows] = useState<(Material | Template)[] | null>(null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const [loadError, setLoadError] = useState("");
  const [retry, setRetry] = useState(0);
  const isMaterial = kind === "materials";
  const collectionPath = isMaterial
    ? workspace
      ? materialCollectionPath(workspace.id)
      : null
    : templateCollectionPath(workspace?.id);

  useEffect(() => {
    if (collectionPath === null || (!workspace && !globalView)) return;

    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setRows(null);
      setNotice("");
      setLoadError("");
    });

    api<unknown>(withSearch(withPage(collectionPath, page), search))
      .then((data) => {
        if (cancelled) return;
        const pagination = normalizePagination<Material | Template>(data);
        setRows(pagination.items);
        setPages(pagination.pages);
      })
      .catch((reason) => {
        if (cancelled) return;
        setRows([]);
        setPages(0);
        setLoadError(
          reason instanceof Error ? reason.message : "Koleksi belum dapat dimuat.",
        );
        if (!isMaterial) {
          setNotice(
            "Layanan template backend belum tersedia; halaman ini siap digunakan setelah endpoint diaktifkan.",
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [collectionPath, globalView, isMaterial, page, retry, search, workspace]);

  const filtered = (rows ?? []).filter((item) => {
    const title = isMaterial
      ? (item as Material).title
      : (item as Template).name;
    return title.toLowerCase().includes(search.toLowerCase());
  });
  const base = workspace ? `/workspaces/${workspace.slug}/${kind}` : `/${kind}`;
  const title = isMaterial
    ? globalView
      ? "Pustaka global"
      : "Materi"
    : globalView
      ? "Pustaka template"
      : "Template";

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Beranda", href: "/dashboard" },
          ...(workspace
            ? [{ label: workspace.name, href: `/workspaces/${workspace.slug}` }]
            : []),
          { label: title },
        ]}
      />
      <PageHeader
        title={title}
        description={
          isMaterial
            ? "Kelola bahan ajar, tautan, dan catatan dalam satu koleksi."
            : "Gunakan kembali struktur terbaik untuk pekerjaan yang konsisten."
        }
        actions={
          <ButtonLink href={`${base}/new`}>
            {isMaterial ? "Materi baru" : "Template baru"}
          </ButtonLink>
        }
      />
      {notice && (
        <p className="mb-5 rounded-lg border border-[#c8bea9] bg-[#fffaf0] p-4 text-sm text-[#6d5734]">
          {notice}
        </p>
      )}
      <div className="mb-5 max-w-xl">
        <Input
          aria-label={`Cari ${isMaterial ? "materi" : "template"}`}
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          placeholder={`Cari ${isMaterial ? "materi" : "template"}…`}
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
        <Skeleton className="h-52" />
      ) : filtered.length === 0 ? (
        <Empty
          title={`Belum ada ${isMaterial ? "materi" : "template"}`}
          description={
            search
              ? "Tidak ada hasil yang cocok."
              : "Tambahkan item pertama untuk membangun koleksi Anda."
          }
          action={<ButtonLink href={`${base}/new`}>Tambah sekarang</ButtonLink>}
        />
      ) : (
        <>
          <ResponsiveTable
            headers={[
              isMaterial ? "Materi" : "Template",
              "Kategori",
              "Deskripsi",
              "Diperbarui",
              "Aksi",
            ]}
          >
            {filtered.map((item) => {
              const name = isMaterial
                ? (item as Material).title
                : (item as Template).name;
              const category = isMaterial
                ? (item as Material).material_type
                : (item as Template).category;
              return (
                <tr key={item.id}>
                  <td data-label={isMaterial ? "Materi" : "Template"}>
                    <Link
                      className="font-semibold text-primary hover:underline"
                      href={`${base}/${item.id}`}
                    >
                      {name}
                    </Link>
                  </td>
                  <td data-label="Kategori">
                    <Badge tone="info">{category || "general"}</Badge>
                  </td>
                  <td data-label="Deskripsi" className="max-w-sm text-muted">
                    {item.description || "—"}
                  </td>
                  <td
                    data-label="Diperbarui"
                    className="whitespace-nowrap text-muted"
                  >
                    {item.updated_at
                      ? new Intl.DateTimeFormat("id-ID").format(
                          new Date(item.updated_at),
                        )
                      : "—"}
                  </td>
                  <td data-label="Aksi">
                    <ButtonLink variant="ghost" href={`${base}/${item.id}/edit`}>
                      Edit
                    </ButtonLink>
                  </td>
                </tr>
              );
            })}
          </ResponsiveTable>
          <Pagination page={page} pages={pages} onPage={setPage} />
        </>
      )}
    </>
  );
}

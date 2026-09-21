"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ChevronUpDownIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";
import { api } from "@/lib/api";
import { normalizePagination } from "@/lib/pagination";
import { sessionSortParameter } from "@/lib/resource-routes";
import { formatTeachingSessionSchedule } from "@/lib/session-schedule";
import { TeachingScheduleTools } from "@/components/teaching-schedule-tools";
import {
  teachingStatusLabel,
  teachingStatusOptions,
  teachingStatusTone,
} from "@/lib/teaching-status";
import type { TeachingSession, Workspace } from "@/lib/types";
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
  Select,
  Skeleton,
} from "@/components/ui";

const size = 10;
export default function SessionsPage() {
  const { slug } = useParams<{ slug: string }>();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [rows, setRows] = useState<TeachingSession[] | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState<"newest" | "title">("newest");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [workspaceError, setWorkspaceError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [workspaceRetry, setWorkspaceRetry] = useState(0);
  const [listRetry, setListRetry] = useState(0);
  useEffect(() => {
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
  }, [slug, workspaceRetry]);
  useEffect(() => {
    if (!workspace) return;
    const q = new URLSearchParams({
      page: String(page),
      page_size: String(size),
    });
    if (search) q.set("search", search);
    if (status) q.set("status", status);
    q.set("sort", sessionSortParameter(sort));
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setRows(null);
      setLoadError("");
    });
    const timer = window.setTimeout(() => {
      void api<unknown>(`/workspaces/${workspace.id}/teaching/sessions?${q}`)
        .then((value) => {
          if (!active) return;
          const data = normalizePagination<TeachingSession>(value);
          setRows(data.items);
          setPages(Math.max(1, data.pages));
        })
        .catch((reason) => {
          if (!active) return;
          setRows([]);
          setLoadError(
            reason instanceof Error ? reason.message : "Sesi belum dapat dimuat.",
          );
        });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [workspace, page, search, status, sort, listRetry]);
  const ordered = useMemo(() => {
    const data = [...(rows ?? [])];
    if (sort === "title") data.sort((a, b) => a.title.localeCompare(b.title));
    return data;
  }, [rows, sort]);
  return (
    <>
      <Breadcrumb
        items={[
          { label: "Ruang", href: `/workspaces/${slug}` },
          { label: "Pengajaran", href: `/workspaces/${slug}/teaching` },
          { label: "Sesi" },
        ]}
      />
      <PageHeader
        title="Sesi pengajaran"
        description="Kelola rencana pertemuan, jadwal, dan kesiapan setiap sesi."
        actions={
          <ButtonLink href={`/workspaces/${slug}/teaching/sessions/new`}>
            Sesi baru
          </ButtonLink>
        }
      />
      <TeachingScheduleTools workspaceId={workspace?.id ? Number(workspace.id) : 0} />
      {workspaceError && (
        <div role="alert" className="error-box mb-5 flex items-center justify-between gap-4">
          <span>{workspaceError}</span>
          <Button type="button" variant="secondary" onClick={() => setWorkspaceRetry((value) => value + 1)}>
            Coba lagi
          </Button>
        </div>
      )}
      {loadError && (
        <div role="alert" className="error-box mb-5 flex items-center justify-between gap-4">
          <span>{loadError}</span>
          <Button type="button" variant="secondary" onClick={() => setListRetry((value) => value + 1)}>
            Coba lagi
          </Button>
        </div>
      )}
      <div className="mb-5 grid gap-3 sm:grid-cols-[minmax(15rem,1fr)_11rem_11rem]">
        <div className="relative">
          <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted" />
          <Input
            aria-label="Cari sesi"
            className="pl-9"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Cari judul, topik, atau mata kuliah…"
          />
        </div>
        <Select
          aria-label="Filter status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          options={[
            { value: "", label: "Semua status" },
            ...teachingStatusOptions,
          ]}
        />
        <label className="relative">
          <ChevronUpDownIcon className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted" />
          <select
            aria-label="Urutkan"
            className="control pl-9"
            value={sort}
            onChange={(e) => setSort(e.target.value as "newest" | "title")}
          >
            <option value="newest">Terbaru</option>
            <option value="title">Judul A–Z</option>
          </select>
        </label>
      </div>
      {workspaceError || loadError ? null : rows === null ? (
        <div className="space-y-3">
          <Skeleton className="h-12" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      ) : ordered.length === 0 ? (
        <Empty
          title="Belum ada sesi"
          description={
            search || status
              ? "Tidak ada sesi yang cocok dengan filter ini."
              : "Buat sesi pertama untuk mulai menyusun pembelajaran."
          }
          action={
            !search &&
            !status && (
              <ButtonLink href={`/workspaces/${slug}/teaching/sessions/new`}>
                Buat sesi
              </ButtonLink>
            )
          }
        />
      ) : (
        <>
          <ResponsiveTable
            headers={[
              "Sesi",
              "Mata kuliah / topik",
              "Audiens",
              "Jadwal",
              "Durasi",
              "Status",
              "Aksi",
            ]}
          >
            {ordered.map((item) => (
              <tr key={item.id}>
                <td data-label="Sesi">
                  <Link
                    className="font-semibold text-primary hover:underline"
                    href={`/workspaces/${slug}/teaching/sessions/${item.id}`}
                  >
                    {item.title}
                  </Link>
                </td>
                <td data-label="Mata kuliah / topik">
                  <span className="block">{item.session_type || "—"}</span>
                  <span className="text-xs text-muted">
                    {item.topic || "—"}
                  </span>
                </td>
                <td data-label="Audiens">{item.audience || "—"}</td>
                <td data-label="Jadwal">
                  {formatTeachingSessionSchedule(item, "medium")}
                </td>
                <td data-label="Durasi">
                  {item.duration_minutes
                    ? `${item.duration_minutes} menit`
                    : "—"}
                </td>
                <td data-label="Status">
                  <Badge tone={teachingStatusTone(item.status)}>
                    {teachingStatusLabel(item.status)}
                  </Badge>
                </td>
                <td data-label="Aksi">
                  <Link
                    className="text-sm font-semibold text-primary hover:underline"
                    href={`/workspaces/${slug}/teaching/sessions/${item.id}/edit`}
                  >
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
          </ResponsiveTable>
          <Pagination page={page} pages={pages} onPage={setPage} />
        </>
      )}
    </>
  );
}

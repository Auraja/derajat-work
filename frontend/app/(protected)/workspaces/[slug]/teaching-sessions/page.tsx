"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronUpDownIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";

import { SessionScheduleView } from "@/components/session-schedule-view";
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
import { api } from "@/lib/api";
import { normalizePagination } from "@/lib/pagination";
import { sessionSortParameter } from "@/lib/resource-routes";
import { formatTeachingSessionSchedule } from "@/lib/session-schedule";
import {
  teachingStatusLabel,
  teachingStatusOptions,
  teachingStatusTone,
} from "@/lib/teaching-status";
import type { TeachingActivity, TeachingSession, Workspace } from "@/lib/types";

const pageSize = 10;

function formatActivityDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(
    new Date(year, month - 1, day),
  );
}

function formatActivitySchedule(activity?: TeachingActivity) {
  if (!activity) return null;
  const start = formatActivityDate(activity.startDate);
  const end = formatActivityDate(activity.endDate);
  return activity.startDate === activity.endDate ? start : `${start} – ${end}`;
}

function instructorsFor(session: TeachingSession) {
  if (session.instructors?.length) return session.instructors;
  return session.instructor ? [session.instructor] : [];
}

export default function SessionsPage() {
  const { slug } = useParams<{ slug: string }>();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [rows, setRows] = useState<TeachingSession[] | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState<"newest" | "title">("newest");
  const [view, setView] = useState<"list" | "schedule">("list");
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
    if (!workspace || view !== "list") return;
    const query = new URLSearchParams({
      page: String(page),
      page_size: String(pageSize),
      sort: sessionSortParameter(sort),
    });
    if (search.trim()) query.set("search", search.trim());
    if (status) query.set("status", status);

    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setRows(null);
      setLoadError("");
    });
    const timer = window.setTimeout(() => {
      void api<unknown>(`/workspaces/${workspace.id}/teaching/sessions?${query}`)
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
  }, [workspace, view, page, search, status, sort, listRetry]);

  const ordered = rows ?? [];

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Ruang", href: `/workspaces/${slug}` },
          { label: "Sesi Mengajar" },
        ]}
      />
      <PageHeader
        title="Sesi Mengajar"
        description="Kelola kegiatan, jadwal, pengajar, dan peserta dalam satu tempat."
        actions={
          <>
            <ButtonLink variant="secondary" href={`/workspaces/${slug}/teaching-sessions/import`}>
              Import JSON
            </ButtonLink>
            <ButtonLink href={`/workspaces/${slug}/teaching-sessions/new`}>
              Tambah sesi
            </ButtonLink>
          </>
        }
      />

      {workspaceError && (
        <div role="alert" className="error-box mb-5 flex items-center justify-between gap-4">
          <span>{workspaceError}</span>
          <Button type="button" variant="secondary" onClick={() => setWorkspaceRetry((value) => value + 1)}>
            Coba lagi
          </Button>
        </div>
      )}

      {!workspaceError && workspace && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-md border border-line bg-surface p-1" aria-label="Tampilan sesi">
            <Button
              type="button"
              variant={view === "list" ? "primary" : "ghost"}
              className="min-h-8 px-3 py-1"
              aria-pressed={view === "list"}
              onClick={() => setView("list")}
            >
              Daftar
            </Button>
            <Button
              type="button"
              variant={view === "schedule" ? "primary" : "ghost"}
              className="min-h-8 px-3 py-1"
              aria-pressed={view === "schedule"}
              onClick={() => setView("schedule")}
            >
              Jadwal
            </Button>
          </div>

          {view === "list" && (
            <div className="grid w-full gap-2 sm:w-auto sm:grid-cols-[minmax(14rem,1fr)_10rem_10rem]">
              <div className="relative">
                <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted" />
                <Input
                  aria-label="Cari sesi"
                  className="pl-9"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Cari kegiatan atau pengajar…"
                />
              </div>
              <Select
                aria-label="Filter status"
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value);
                  setPage(1);
                }}
                options={[{ value: "", label: "Semua status" }, ...teachingStatusOptions]}
              />
              <label className="relative">
                <ChevronUpDownIcon className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted" />
                <select
                  aria-label="Urutkan"
                  className="control pl-9"
                  value={sort}
                  onChange={(event) => setSort(event.target.value as "newest" | "title")}
                >
                  <option value="newest">Terbaru</option>
                  <option value="title">Judul A–Z</option>
                </select>
              </label>
            </div>
          )}
        </div>
      )}

      {workspaceError || !workspace ? null : view === "schedule" ? (
        <SessionScheduleView workspaceId={Number(workspace.id)} />
      ) : (
        <>
          {loadError && (
            <div role="alert" className="error-box mb-5 flex items-center justify-between gap-4">
              <span>{loadError}</span>
              <Button type="button" variant="secondary" onClick={() => setListRetry((value) => value + 1)}>
                Coba lagi
              </Button>
            </div>
          )}
          {loadError ? null : rows === null ? (
            <div className="space-y-3">
              <Skeleton className="h-12" />
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </div>
          ) : ordered.length === 0 ? (
            <Empty
              title="Belum ada sesi"
              description={search || status ? "Tidak ada sesi yang cocok dengan filter ini." : "Tambahkan sesi pertama atau import jadwal dalam format JSON."}
              action={!search && !status ? <ButtonLink href={`/workspaces/${slug}/teaching-sessions/new`}>Buat sesi pertama</ButtonLink> : undefined}
            />
          ) : (
            <>
              <ResponsiveTable headers={["Kegiatan", "Jadwal", "Pengajar", "Status", "Aksi"]}>
                {ordered.map((item) => {
                  const secondary = [item.location, item.participant_label || item.audience].filter(Boolean);
                  const activity = item.activities?.[0];
                  return (
                    <tr key={item.id}>
                      <td data-label="Kegiatan">
                        <Link className="font-semibold text-primary hover:underline" href={`/workspaces/${slug}/teaching-sessions/${item.id}`}>
                          {item.title}
                        </Link>
                        {secondary.length > 0 && (
                          <span className="mt-1 flex flex-wrap gap-x-2 text-xs text-muted">
                            {secondary.map((value) => <span key={value}>{value}</span>)}
                          </span>
                        )}
                      </td>
                      <td data-label="Jadwal">
                        <span className="block">{formatActivitySchedule(activity) || formatTeachingSessionSchedule(item, "medium")}</span>
                        {activity?.mode && <span className="mt-1 block text-xs text-muted">{activity.mode}</span>}
                      </td>
                      <td data-label="Pengajar">{instructorsFor(item).join(", ") || "—"}</td>
                      <td data-label="Status">
                        <Badge tone={teachingStatusTone(item.status)}>{teachingStatusLabel(item.status)}</Badge>
                      </td>
                      <td data-label="Aksi">
                        <Link className="text-sm font-semibold text-primary hover:underline" href={`/workspaces/${slug}/teaching-sessions/${item.id}/edit`}>
                          Edit
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </ResponsiveTable>
              <Pagination page={page} pages={pages} onPage={setPage} />
            </>
          )}
        </>
      )}
    </>
  );
}

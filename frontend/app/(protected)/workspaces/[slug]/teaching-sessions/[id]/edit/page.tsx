"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { SessionForm } from "@/components/session-form";
import { Breadcrumb, Button, PageHeader, Skeleton } from "@/components/ui";
import { api } from "@/lib/api";
import type { TeachingSession } from "@/lib/types";

export default function EditSessionPage() {
  const { slug, id } = useParams<{ slug: string; id: string }>();
  const [session, setSession] = useState<TeachingSession | null>(null);
  const [loadError, setLoadError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setSession(null);
      setLoadError("");
    });
    api<TeachingSession>(`/teaching/sessions/${id}`)
      .then((value) => {
        if (active) setSession(value);
      })
      .catch((reason) => {
        if (!active) return;
        setLoadError(reason instanceof Error ? reason.message : "Sesi belum dapat dimuat.");
      });
    return () => {
      active = false;
    };
  }, [id, retry]);

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Sesi Mengajar", href: `/workspaces/${slug}/teaching-sessions` },
          { label: "Detail sesi", href: `/workspaces/${slug}/teaching-sessions/${id}` },
          { label: "Edit" },
        ]}
      />
      <PageHeader title="Edit sesi" description="Perbarui jadwal, pengajar, peserta, dan detail sesi." />
      {loadError ? (
        <div role="alert" className="error-box flex items-center justify-between gap-4">
          <span>{loadError}</span>
          <Button type="button" variant="secondary" onClick={() => setRetry((value) => value + 1)}>
            Coba lagi
          </Button>
        </div>
      ) : session ? (
        <SessionForm session={session} />
      ) : (
        <Skeleton className="h-96" />
      )}
    </>
  );
}

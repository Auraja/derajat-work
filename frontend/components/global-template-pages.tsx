"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import type { Template } from "@/lib/types";
import { Breadcrumb, Button, PageHeader, Skeleton } from "@/components/ui";
import { TemplateForm } from "@/components/template-form";
import { ResourceDetail } from "@/components/resource-detail";
export function GlobalTemplateEditor({ edit = false }: { edit?: boolean }) {
  const { id } = useParams<{ id?: string }>();
  const [item, setItem] = useState<Template | null>(null);
  const [loadError, setLoadError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!edit || !id) return;
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setItem(null);
      setLoadError("");
    });
    api<Template>(`/templates/${id}`)
      .then((value) => {
        if (active) setItem(value);
      })
      .catch((reason) => {
        if (!active) return;
        setLoadError(
          reason instanceof Error ? reason.message : "Template belum dapat dimuat.",
        );
      });
    return () => {
      active = false;
    };
  }, [edit, id, retry]);
  if (loadError)
    return (
      <div role="alert" className="error-box flex items-center justify-between gap-4">
        <span>{loadError}</span>
        <Button type="button" variant="secondary" onClick={() => setRetry((value) => value + 1)}>
          Coba lagi
        </Button>
      </div>
    );
  if (edit && !item) return <Skeleton className="h-64" />;
  return (
    <>
      <Breadcrumb
        items={[
          { label: "Templates", href: "/templates" },
          { label: edit ? "Edit template" : "Template baru" },
        ]}
      />
      <PageHeader
        title={edit ? "Edit template" : "Template baru"}
        description="Kelola pola kerja yang dapat digunakan lintas workspace."
      />
      <TemplateForm template={item ?? undefined} />
    </>
  );
}
export function GlobalTemplateDetail() {
  const { id } = useParams<{ id: string }>();
  return <ResourceDetail kind="templates" id={id} />;
}

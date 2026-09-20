"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import type { Material, Template, Workspace } from "@/lib/types";
import { Breadcrumb, Button, PageHeader, Skeleton } from "@/components/ui";
import { MaterialForm } from "@/components/material-form";
import { TemplateForm } from "@/components/template-form";
import { ResourceList } from "@/components/resource-list";
import { ResourceDetail } from "@/components/resource-detail";

function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="error-box flex items-center justify-between gap-4">
      <span>{message}</span>
      <Button type="button" variant="secondary" onClick={onRetry}>
        Coba lagi
      </Button>
    </div>
  );
}

function useWorkspace() {
  const { slug } = useParams<{ slug: string }>();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setWorkspace(null);
      setError("");
    });
    api<Workspace>(`/workspaces/${slug}`)
      .then((value) => {
        if (active) setWorkspace(value);
      })
      .catch((reason) => {
        if (!active) return;
        setError(
          reason instanceof Error ? reason.message : "Ruang belum dapat dimuat.",
        );
      });
    return () => {
      active = false;
    };
  }, [slug, retry]);
  return {
    workspace,
    error,
    retry: () => setRetry((value) => value + 1),
  };
}
export function WorkspaceResourceList({
  kind,
}: {
  kind: "materials" | "templates";
}) {
  const { workspace, error, retry } = useWorkspace();
  if (error) return <LoadError message={error} onRetry={retry} />;
  return workspace ? (
    <ResourceList kind={kind} workspace={workspace} />
  ) : (
    <Skeleton className="h-64" />
  );
}
export function WorkspaceResourceEditor({
  kind,
  edit = false,
}: {
  kind: "materials" | "templates";
  edit?: boolean;
}) {
  const { workspace, error: workspaceError, retry: retryWorkspace } = useWorkspace();
  const { id } = useParams<{ id?: string }>();
  const [item, setItem] = useState<Material | Template | null>(null);
  const [itemError, setItemError] = useState("");
  const [itemRetry, setItemRetry] = useState(0);
  useEffect(() => {
    if (!edit || !id) return;
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setItem(null);
      setItemError("");
    });
    api<Material | Template>(`/${kind}/${id}`)
      .then((value) => {
        if (active) setItem(value);
      })
      .catch((reason) => {
        if (!active) return;
        setItemError(
          reason instanceof Error ? reason.message : "Item belum dapat dimuat.",
        );
      });
    return () => {
      active = false;
    };
  }, [edit, id, kind, itemRetry]);
  if (workspaceError)
    return <LoadError message={workspaceError} onRetry={retryWorkspace} />;
  if (itemError)
    return (
      <LoadError
        message={itemError}
        onRetry={() => setItemRetry((value) => value + 1)}
      />
    );
  if (!workspace || (edit && !item)) return <Skeleton className="h-64" />;
  const label = kind === "materials" ? "materi" : "template";
  return (
    <>
      <Breadcrumb
        items={[
          { label: workspace.name, href: `/workspaces/${workspace.slug}` },
          { label: kind, href: `/workspaces/${workspace.slug}/${kind}` },
          {
            label: edit
              ? `Edit ${label}`
              : `${label[0].toUpperCase() + label.slice(1)} baru`,
          },
        ]}
      />
      <PageHeader
        title={
          edit
            ? `Edit ${label}`
            : `${label[0].toUpperCase() + label.slice(1)} baru`
        }
        description={
          kind === "materials"
            ? "Simpan bahan ajar agar mudah ditemukan dan digunakan kembali."
            : "Bangun struktur yang dapat dipakai berulang kali."
        }
      />
      {kind === "materials" ? (
        <MaterialForm
          workspace={workspace}
          material={item as Material | undefined}
        />
      ) : (
        <TemplateForm
          workspace={workspace}
          template={item as Template | undefined}
        />
      )}
    </>
  );
}
export function WorkspaceResourceDetail({
  kind,
}: {
  kind: "materials" | "templates";
}) {
  const { workspace, error, retry } = useWorkspace();
  const { id } = useParams<{ id: string }>();
  if (error) return <LoadError message={error} onRetry={retry} />;
  return workspace ? (
    <ResourceDetail kind={kind} id={id} workspace={workspace} />
  ) : (
    <Skeleton className="h-64" />
  );
}

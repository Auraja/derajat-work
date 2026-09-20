"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { Material, Template, Workspace } from "@/lib/types";
import {
  Badge,
  Breadcrumb,
  Button,
  ButtonLink,
  PageHeader,
  Skeleton,
} from "@/components/ui";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
export function ResourceDetail({
  kind,
  id,
  workspace,
}: {
  kind: "materials" | "templates";
  id: string;
  workspace?: Workspace;
}) {
  const singular = kind === "materials" ? "materials" : "templates";
  const [item, setItem] = useState<Material | Template | null>(null);
  const [loadError, setLoadError] = useState("");
  const [retry, setRetry] = useState(0);
  const [confirm, setConfirm] = useState(false);
  const router = useRouter();
  const { show } = useToast();
  const base = workspace ? `/workspaces/${workspace.slug}/${kind}` : `/${kind}`;
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setItem(null);
      setLoadError("");
    });
    api<Material | Template>(`/${singular}/${id}`)
      .then((value) => {
        if (active) setItem(value);
      })
      .catch((reason) => {
        if (!active) return;
        setLoadError(
          reason instanceof Error ? reason.message : "Item belum dapat dimuat.",
        );
      });
    return () => {
      active = false;
    };
  }, [id, singular, retry]);
  async function remove() {
    try {
      await api(`/${singular}/${id}`, { method: "DELETE" });
      show("Item berhasil dihapus.");
      router.replace(base);
      router.refresh();
    } catch (reason) {
      show(
        reason instanceof Error ? reason.message : "Gagal menghapus item.",
        "error",
      );
    }
  }
  if (loadError)
    return (
      <div role="alert" className="error-box flex items-center justify-between gap-4">
        <span>{loadError}</span>
        <Button type="button" variant="secondary" onClick={() => setRetry((value) => value + 1)}>
          Coba lagi
        </Button>
      </div>
    );
  if (!item)
    return (
      <>
        <Skeleton className="h-10 w-72" />
        <Skeleton className="mt-6 h-60" />
      </>
    );
  const isMaterial = kind === "materials";
  const name = isMaterial ? (item as Material).title : (item as Template).name;
  const category = isMaterial
    ? (item as Material).material_type
    : (item as Template).category;
  const content = isMaterial
    ? (item as Material).content
    : String((item as Template).config_json?.content ?? "");
  return (
    <>
      <Breadcrumb items={[{ label: kind, href: base }, { label: name }]} />
      <PageHeader
        title={name}
        description={item.description || "Tidak ada deskripsi."}
        actions={
          <>
            <ButtonLink variant="secondary" href={`${base}/${id}/edit`}>
              Edit
            </ButtonLink>
            <Button variant="danger" onClick={() => setConfirm(true)}>
              Hapus
            </Button>
          </>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <section className="surface min-w-0 p-6">
          <h2 className="font-serif text-xl text-primary">Konten</h2>
          <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7 text-[#50524f]">
            {content || "Belum ada konten."}
          </p>
          {isMaterial && (item as Material).content_url && (
            <a
              className="mt-5 inline-block break-all text-sm font-semibold text-primary underline"
              href={(item as Material).content_url!}
              target="_blank"
              rel="noreferrer"
            >
              Buka sumber
            </a>
          )}
        </section>
        <aside className="surface h-fit p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-muted">
            Kategori
          </p>
          <div className="mt-2">
            <Badge tone="info">{category || "general"}</Badge>
          </div>
          {isMaterial && (item as Material).tags && (
            <div className="mt-5 flex flex-wrap gap-2">
              {(item as Material).tags!.map((tag) => (
                <Badge key={tag}>{tag}</Badge>
              ))}
            </div>
          )}
        </aside>
      </div>
      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={remove}
        title="Hapus item?"
        description="Tindakan ini tidak dapat dibatalkan."
      />
    </>
  );
}

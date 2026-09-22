"use client";

import { useParams } from "next/navigation";

import { SessionForm } from "@/components/session-form";
import { Breadcrumb, PageHeader } from "@/components/ui";

export default function NewSessionPage() {
  const { slug } = useParams<{ slug: string }>();
  return (
    <>
      <Breadcrumb
        items={[
          { label: "Ruang", href: `/workspaces/${slug}` },
          { label: "Sesi Mengajar", href: `/workspaces/${slug}/teaching-sessions` },
          { label: "Tambah sesi" },
        ]}
      />
      <PageHeader
        title="Tambah sesi"
        description="Isi jadwal utama dan pengajar. Detail pendukung dapat ditambahkan bila diperlukan."
      />
      <SessionForm />
    </>
  );
}

"use client";

import {
  ArrowRightIcon,
  ClipboardDocumentListIcon,
  DocumentTextIcon,
  PresentationChartBarIcon,
  QuestionMarkCircleIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Breadcrumb, ButtonLink, PageHeader } from "@/components/ui";

export default function TeachingOverview() {
  const { slug } = useParams<{ slug: string }>();
  const base = `/workspaces/${slug}/teaching`;
  const sessionsBase = `/workspaces/${slug}/teaching-sessions`;
  const tools = [
    ["Presentation Slides", "Ubah topik menjadi struktur presentasi yang jelas.", "/slides", PresentationChartBarIcon],
    ["Learning Module", "Susun modul pembelajaran terarah.", "/modules", DocumentTextIcon],
    ["Quiz Generator", "Buat rancangan kuis sesuai tingkat kesulitan.", "/quizzes", QuestionMarkCircleIcon],
    ["Assignment", "Rancang tugas beserta konteks penilaiannya.", "/assignments", ClipboardDocumentListIcon],
  ] as const;

  return (
    <>
      <Breadcrumb items={[{ label: "Ruang", href: `/workspaces/${slug}` }, { label: "Mengajar" }]} />
      <PageHeader
        title="Mengajar"
        description="Siapkan bahan ajar dan perangkat pembelajaran."
        actions={<ButtonLink href={`${sessionsBase}/new`}>Tambah sesi</ButtonLink>}
      />
      <section className="surface p-6">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div>
            <p className="eyebrow">Sesi Mengajar</p>
            <h2 className="mt-2 font-serif text-2xl text-primary">Atur jadwal secara terpisah</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
              Kelola pengajar, waktu, lokasi, dan peserta di modul Sesi Mengajar.
            </p>
          </div>
          <ButtonLink href={sessionsBase} variant="secondary">Lihat semua sesi</ButtonLink>
        </div>
      </section>
      <h2 className="mt-8 mb-4 font-serif text-2xl text-primary">Perangkat perencanaan</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {tools.map(([name, description, suffix, Icon]) => (
          <Link key={name} href={`${base}${suffix}`} className="surface group flex gap-4 p-5 transition hover:border-[#bcae98]">
            <span className="h-fit rounded-lg bg-[#e7e9e1] p-3 text-secondary"><Icon className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1">
              <h3 className="font-serif text-lg text-primary">{name}</h3>
              <p className="mt-1 text-sm leading-6 text-muted">{description}</p>
            </div>
            <ArrowRightIcon className="mt-1 h-4 w-4 text-muted transition group-hover:translate-x-1" />
          </Link>
        ))}
      </div>
    </>
  );
}

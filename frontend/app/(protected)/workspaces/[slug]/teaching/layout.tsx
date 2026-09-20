"use client";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";

const tabs = [
  ["Ringkasan", ""], ["Sesi", "/sessions"], ["Materi", "/materials"], ["Template", "/templates"], ["Slide", "/slides"], ["Modul", "/modules"], ["Kuis", "/quizzes"], ["Tugas", "/assignments"], ["Rencana pembelajaran", "/lesson-plans"],
];
export default function TeachingLayout({ children }: { children: React.ReactNode }) {
  const { slug } = useParams<{slug:string}>(); const pathname = usePathname(); const base = `/workspaces/${slug}/teaching`;
  return <><div className="mb-7 overflow-x-auto border-b border-line"><nav aria-label="Navigasi pengajaran" className="flex min-w-max gap-1">{tabs.map(([label,suffix]) => { const href = `${base}${suffix}`; const active = suffix ? pathname.startsWith(href) : pathname === base; return <Link key={label} href={href} className={`border-b-2 px-3 py-3 text-sm font-semibold ${active ? "border-accent text-primary" : "border-transparent text-muted hover:text-primary"}`}>{label}</Link>; })}</nav></div>{children}</>;
}

"use client";

import { useParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { Breadcrumb, Button, PageHeader, Skeleton } from "@/components/ui";
import { api, jsonBody } from "@/lib/api";
import type { Workspace } from "@/lib/types";

type Card = { id: number; column_id: number; title: string; description: string | null; position: number };
type Column = { id: number; workspace_id: number; title: string; position: number; cards: Card[] };
type Board = { columns: Column[] };

export default function ProjectsPage() {
  const { slug } = useParams<{ slug: string }>();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [columnTitle, setColumnTitle] = useState("");
  const [newCards, setNewCards] = useState<Record<number, string>>({});
  const [error, setError] = useState("");
  const canWrite = workspace?.role === "owner" || workspace?.role === "admin";

  const load = useCallback(async () => {
    try {
      const room = await api<Workspace>(`/workspaces/${slug}`);
      const value = await api<Board>(`/workspaces/${room.id}/kanban`);
      setWorkspace(room); setBoard(value); setError("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Papan gagal dimuat."); }
  }, [slug]);
  useEffect(() => {
    let active = true;
    void api<Workspace>(`/workspaces/${slug}`)
      .then(async (room) => ({ room, value: await api<Board>(`/workspaces/${room.id}/kanban`) }))
      .then(({ room, value }) => {
        if (!active) return;
        setWorkspace(room); setBoard(value); setError("");
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : "Papan gagal dimuat.");
      });
    return () => { active = false; };
  }, [slug]);

  async function addColumn(event: FormEvent) {
    event.preventDefault(); if (!workspace || !columnTitle.trim()) return;
    try {
      const column = await api<Column>(`/workspaces/${workspace.id}/kanban/columns`, { method: "POST", ...jsonBody({ title: columnTitle }) });
      setBoard((current) => ({ columns: [...(current?.columns ?? []), { ...column, cards: column.cards ?? [] }] })); setColumnTitle("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Kolom gagal ditambahkan."); }
  }
  async function renameColumn(column: Column) {
    if (!workspace) return; const title = window.prompt("Judul kolom", column.title)?.trim(); if (!title) return;
    const updated = await api<Column>(`/workspaces/${workspace.id}/kanban/columns/${column.id}`, { method: "PATCH", ...jsonBody({ title }) });
    setBoard((b) => ({ columns: (b?.columns ?? []).map((item) => item.id === column.id ? { ...item, title: updated.title } : item) }));
  }
  async function removeColumn(column: Column) {
    if (!workspace || !window.confirm(`Hapus kolom “${column.title}”? Kolom berisi kartu harus dikosongkan lebih dahulu.`)) return;
    try { await api(`/workspaces/${workspace.id}/kanban/columns/${column.id}`, { method: "DELETE" }); setBoard((b) => ({ columns: (b?.columns ?? []).filter((item) => item.id !== column.id) })); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Kolom gagal dihapus."); }
  }
  async function addCard(event: FormEvent, column: Column) {
    event.preventDefault(); if (!workspace || !newCards[column.id]?.trim()) return;
    const card = await api<Card>(`/workspaces/${workspace.id}/kanban/cards`, { method: "POST", ...jsonBody({ column_id: column.id, title: newCards[column.id] }) });
    setBoard((b) => ({ columns: (b?.columns ?? []).map((item) => item.id === column.id ? { ...item, cards: [...item.cards, card] } : item) })); setNewCards((v) => ({ ...v, [column.id]: "" }));
  }
  async function editCard(card: Card) {
    if (!workspace) return; const title = window.prompt("Judul kartu", card.title)?.trim(); if (!title) return;
    const description = window.prompt("Deskripsi kartu (opsional)", card.description ?? "");
    const updated = await api<Card>(`/workspaces/${workspace.id}/kanban/cards/${card.id}`, { method: "PATCH", ...jsonBody({ title, description }) }); updateCard(updated);
  }
  function updateCard(updated: Card) { setBoard((b) => ({ columns: (b?.columns ?? []).map((column) => ({ ...column, cards: column.cards.filter((card) => card.id !== updated.id).concat(column.id === updated.column_id ? [updated] : []) })) })); }
  async function moveCard(card: Card, columnId: number) {
    if (!workspace || columnId === card.column_id) return;
    const updated = await api<Card>(`/workspaces/${workspace.id}/kanban/cards/${card.id}`, { method: "PATCH", ...jsonBody({ column_id: columnId }) }); updateCard(updated);
  }
  async function removeCard(card: Card) {
    if (!workspace || !window.confirm(`Hapus kartu “${card.title}”?`)) return;
    await api(`/workspaces/${workspace.id}/kanban/cards/${card.id}`, { method: "DELETE" }); setBoard((b) => ({ columns: (b?.columns ?? []).map((column) => ({ ...column, cards: column.cards.filter((item) => item.id !== card.id) })) }));
  }

  if (!workspace || !board) return error ? <section role="alert" className="error-box">{error}<Button onClick={load} className="ml-3">Coba lagi</Button></section> : <Skeleton className="h-80" />;
  return <div>
    <Breadcrumb items={[{ label: workspace.name, href: `/workspaces/${slug}` }, { label: "Proyek" }]} />
    <PageHeader eyebrow="Proyek workspace" title="Papan Proyek" description="Atur pekerjaan tim dalam kolom dan pindahkan kartu sesuai progres." />
    {error && <p role="alert" className="error-box mb-4">{error}</p>}
    {canWrite && <form onSubmit={addColumn} className="mb-6 flex flex-col gap-2 sm:flex-row">
      <label className="sr-only" htmlFor="new-column">Judul kolom baru</label><input id="new-column" className="control sm:max-w-sm" value={columnTitle} onChange={(e) => setColumnTitle(e.target.value)} placeholder="Contoh: Akan dikerjakan" />
      <Button type="submit">Tambah kolom</Button>
    </form>}
    <div className="kanban-board" aria-label="Papan kanban">
      {board.columns.length === 0 && <p className="surface p-8 text-sm text-muted">Belum ada kolom. Tambahkan kolom pertama untuk memulai.</p>}
      {board.columns.map((column) => <section className="kanban-column" key={column.id} aria-labelledby={`column-${column.id}`}>
        <div className="flex items-center justify-between gap-2"><h2 id={`column-${column.id}`} className="editorial-title text-xl">{column.title}</h2><span className="private-mark">{column.cards.length}</span></div>
        {canWrite && <div className="mt-2 flex gap-2"><Button variant="ghost" onClick={() => renameColumn(column)}>Ubah judul</Button><Button variant="ghost" onClick={() => removeColumn(column)}>Hapus</Button></div>}
        <div className="mt-4 space-y-3">{column.cards.map((card) => <article className="kanban-card" key={card.id}>
          <h3 className="font-semibold">{card.title}</h3>{card.description && <p className="mt-2 text-sm text-muted">{card.description}</p>}
          {canWrite && <><label className="label mt-3" htmlFor={`move-${card.id}`}>Pindahkan {card.title}</label><select id={`move-${card.id}`} className="control" value={card.column_id} onChange={(e) => void moveCard(card, Number(e.target.value))}>{board.columns.map((target) => <option key={target.id} value={target.id}>{target.title}</option>)}</select><div className="mt-2 flex gap-2"><Button variant="ghost" onClick={() => editCard(card)}>Edit</Button><Button variant="ghost" onClick={() => removeCard(card)}>Hapus</Button></div></>}
        </article>)}</div>
        {canWrite && <form onSubmit={(e) => addCard(e, column)} className="mt-4"><label className="label" htmlFor={`card-${column.id}`}>Kartu baru di {column.title}</label><input id={`card-${column.id}`} className="control" value={newCards[column.id] ?? ""} onChange={(e) => setNewCards((v) => ({ ...v, [column.id]: e.target.value }))} /><Button type="submit" className="mt-2 w-full">Tambah kartu</Button></form>}
      </section>)}
    </div>
  </div>;
}

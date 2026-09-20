"use client";
/* eslint-disable react-hooks/refs -- dnd-kit callback refs are consumed during render. */

import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Button, PageHeader, Skeleton } from "@/components/ui";
import { ModalFrame } from "@/components/ui/modal-frame";
import { api, jsonBody } from "@/lib/api";
import { moveCardInBoard, type CardPriority, type KanbanBoard as Board, type KanbanCard as Card, type KanbanCardDetail as Detail, type KanbanColumn as Column } from "@/lib/kanban";

const priorityNames: Record<CardPriority, string> = { low: "Rendah", medium: "Sedang", high: "Tinggi", urgent: "Mendesak" };
const priorityBarClasses: Record<CardPriority, string> = {
  low: "bg-[#6f8f65]",
  medium: "bg-[#5e7f9f]",
  high: "bg-[#bd8730]",
  urgent: "bg-[#a84539]",
};
const priorities: CardPriority[] = ["urgent", "high", "medium", "low"];
const priorityOrder: Record<CardPriority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
const DAY = 86_400_000;
const GANTT_DAY_WIDTH = 34;
const defaultCard = (card: Card): Card => ({ ...card, assignee: card.assignee ?? null, priority: card.priority ?? "medium", due_date: card.due_date ?? null, start_date: card.start_date ?? null, labels: card.labels ?? [], checklist_total: card.checklist_total ?? 0, checklist_completed: card.checklist_completed ?? 0, archived_at: card.archived_at ?? null, created_at: card.created_at ?? "", updated_at: card.updated_at ?? "" });
const dateValue = (value: string) => Date.parse(`${value}T00:00:00Z`);
const fullDate = (value: number) => new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(value);
const monthDate = (value: number) => new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "UTC" }).format(value);
const weekdayNames = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

function CardView({ card: raw, board, mutate, edit, remove }: { card: Card; board: Board; mutate: (card: Card, values: Partial<Card>) => Promise<boolean>; edit: (card: Card) => void; remove: (card: Card) => Promise<void> }) {
  const card = defaultCard(raw);
  const [expanded, setExpanded] = useState(false);
  const writable = board.workspaces.some((workspace) => workspace.id === card.workspace_id && workspace.can_write);
  const sortable = useSortable({ id: `card-${card.id}`, data: { card }, disabled: !writable, transition: { duration: 180, easing: "cubic-bezier(.2,.8,.2,1)" } });
  const overdue = card.due_date && card.due_date < new Date().toISOString().slice(0, 10);
  const detailsId = `card-details-${card.id}`;
  const workspaceName = board.workspaces.find((workspace) => workspace.id === card.workspace_id)?.name;

  return <article ref={sortable.setNodeRef} style={{ transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition, opacity: sortable.isDragging ? .24 : 1, willChange: sortable.isDragging ? "transform" : undefined }} className={`kanban-card ${sortable.isDragging ? "is-dragging" : ""}`} aria-label={card.title}>
    <div className="kanban-card-summary">
      {writable && <button type="button" className="kanban-drag-handle" aria-label={`Seret ${card.title}`} {...sortable.attributes} {...sortable.listeners}>⠿</button>}
      <button type="button" className="flex min-w-0 flex-1 items-start gap-2 text-left" aria-expanded={expanded} aria-controls={detailsId} onClick={() => setExpanded((value) => !value)}>
        <span className={`priority-dot mt-1.5 ${priorityBarClasses[card.priority]}`} aria-label={`Prioritas ${priorityNames[card.priority]}`} />
        <span className="min-w-0 flex-1 break-words text-sm font-semibold leading-snug">{card.title}</span>
        {card.due_date && <span className={`hidden shrink-0 text-[.68rem] sm:inline ${overdue ? "font-semibold text-red-700" : "text-muted"}`}>{card.due_date}</span>}
        <span aria-hidden className={`text-muted transition-transform ${expanded ? "rotate-180" : ""}`}>⌄</span>
      </button>
      {writable && <button type="button" className="icon-button h-8 w-8 shrink-0" aria-label="Edit kartu" onClick={() => edit(card)}>✎</button>}
    </div>
    <div id={detailsId} hidden={!expanded} className="kanban-card-details">
      <div className="flex flex-wrap gap-1">{card.labels.map((label) => <span key={label} className="rounded-full bg-[#ece6dc] px-2 py-0.5 text-xs">{label}</span>)}</div>
      <dl className="grid gap-1 text-xs text-muted"><div>PT: {workspaceName}</div><div>Prioritas: {priorityNames[card.priority]}</div>{card.assignee && <div>PIC: {card.assignee}</div>}{card.start_date && <div>Mulai: {card.start_date}</div>}{card.due_date && <div className={overdue ? "font-semibold text-red-700" : ""}>{overdue ? "Terlambat" : "Deadline"}: {card.due_date}</div>}{card.checklist_total > 0 && <div>Checklist: {card.checklist_completed}/{card.checklist_total}</div>}</dl>
      {writable && <div className="grid gap-2"><div><label className="label" htmlFor={`delegate-${card.id}`}>Delegasikan {card.title}</label><select id={`delegate-${card.id}`} className="control" value={card.workspace_id} onChange={(event) => void mutate(card, { workspace_id: Number(event.target.value) })}>{board.workspaces.filter((w) => w.can_write).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></div><Button className="justify-self-start" variant="ghost" onClick={() => void remove(card)}>Hapus kartu</Button></div>}
    </div>
  </article>;
}

function DragCardPreview({ card }: { card: Card }) {
  return <article className="kanban-card drag-card-preview"><div className="kanban-card-summary"><span className={`priority-dot mt-1.5 ${priorityBarClasses[card.priority]}`} aria-hidden /><strong className="min-w-0 flex-1 break-words text-sm leading-snug">{card.title}</strong></div></article>;
}

function BoardColumn({ column, board, mutate, edit, remove, add, archiveDone }: { column: Column; board: Board; mutate: (card: Card, values: Partial<Card>) => Promise<boolean>; edit: (card: Card) => void; remove: (card: Card) => Promise<void>; add: (id: number) => void; archiveDone: (cards: Card[]) => Promise<void> }) {
  const drop = useDroppable({ id: `column-${column.id}`, disabled: !column.can_move_into });
  const done = column.title.trim().toLowerCase() === "done";
  const archivable = column.cards.filter((card) => board.workspaces.some((workspace) => workspace.id === card.workspace_id && workspace.can_write));
  return <section ref={drop.setNodeRef} className={`kanban-column ${drop.isOver ? "ring-2 ring-accent" : ""}`} aria-labelledby={`status-${column.id}`}><div className="flex items-center justify-between gap-3 border-b border-line pb-3"><h2 id={`status-${column.id}`} className="font-semibold">{column.title}</h2><span className="rounded-full bg-[#ece6dc] px-2 py-0.5 text-xs text-muted">{column.cards.length}</span></div><SortableContext items={column.cards.map((card) => `card-${card.id}`)} strategy={verticalListSortingStrategy}><div className="mt-4 space-y-2">{column.cards.map((card) => <CardView key={card.id} card={card} board={board} mutate={mutate} edit={edit} remove={remove} />)}</div></SortableContext>{done && archivable.length > 0 && <Button className="mt-4 w-full" variant="ghost" aria-label="Arsipkan semua tugas Done" onClick={() => void archiveDone(archivable)}>Arsipkan selesai</Button>}{column.can_create && <Button className="mt-2 w-full" variant="secondary" onClick={() => add(column.id)}>Tambah kartu</Button>}</section>;
}

function PriorityLegend() {
  return <div className="priority-legend" aria-label="Legenda prioritas">{priorities.map((priority) => <span key={priority}><i className={`priority-dot ${priorityBarClasses[priority]}`} aria-hidden />{priorityNames[priority]}</span>)}</div>;
}

function GanttTimeline({ board }: { board: Board }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const items = board.columns.flatMap((column) => column.cards.map((raw) => ({ card: defaultCard(raw), status: column.title }))).filter(({ card }) => card.start_date || card.due_date).map(({ card, status }) => {
    const start = dateValue(card.start_date ?? card.due_date!);
    const due = dateValue(card.due_date ?? card.start_date!);
    return { card, status, start: Math.min(start, due), due: Math.max(start, due) };
  });
  const currentYear = new Date().getFullYear();
  const calendarYears = Array.from({ length: Math.max(1, currentYear - 2026 + 1) }, (_, index) => 2026 + index);
  const availableYears = Array.from(new Set([...calendarYears, currentYear, ...items.flatMap((item) => [new Date(item.start).getUTCFullYear(), new Date(item.due).getUTCFullYear()])])).sort((left, right) => right - left);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [visibleMonth, setVisibleMonth] = useState(monthDate(Date.UTC(currentYear, 0, 1)));
  const today = dateValue(new Date().toISOString().slice(0, 10));
  const first = Date.UTC(selectedYear, 0, 1);
  const last = Date.UTC(selectedYear, 11, 31);
  const dayCount = Math.floor((last - first) / DAY) + 1;
  const days = Array.from({ length: dayCount }, (_, index) => {
    const timestamp = first + (index * DAY);
    const date = new Date(timestamp);
    const weekday = date.getUTCDay();
    return { timestamp, index, day: date.getUTCDate(), weekday, weekend: weekday === 0 || weekday === 6, today: timestamp === today, monthKey: `${date.getUTCFullYear()}-${date.getUTCMonth()}` };
  });
  const months = days.reduce<{ key: string; label: string; count: number }[]>((groups, day) => {
    const current = groups.at(-1);
    if (current?.key === day.monthKey) current.count += 1;
    else groups.push({ key: day.monthKey, label: monthDate(day.timestamp), count: 1 });
    return groups;
  }, []);
  const timelineWidth = days.length * GANTT_DAY_WIDTH;
  const gridTemplateColumns = `13rem ${timelineWidth}px`;
  const visibleItems = items.filter((item) => item.due >= first && item.start <= last);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const target = selectedYear === currentYear ? today : first;
      const index = Math.max(0, Math.min(days.length - 1, Math.floor((target - first) / DAY)));
      const left = Math.max(0, (index * GANTT_DAY_WIDTH) - 80);
      const element = scrollRef.current;
      if (element) {
        if (typeof element.scrollTo === "function") element.scrollTo({ left, behavior: "auto" });
        else element.scrollLeft = left;
      }
      setVisibleMonth(monthDate(first + (index * DAY)));
    });
    return () => cancelAnimationFrame(frame);
  }, [currentYear, first, selectedYear, today, days.length]);

  function scrollToToday() { if (selectedYear !== currentYear) { setSelectedYear(currentYear); return; } const index = Math.max(0, Math.min(days.length - 1, Math.floor((today - first) / DAY))); const left = Math.max(0, (index * GANTT_DAY_WIDTH) - 80); if (scrollRef.current && typeof scrollRef.current.scrollTo === "function") scrollRef.current.scrollTo({ left, behavior: "smooth" }); else if (scrollRef.current) scrollRef.current.scrollLeft = left; setVisibleMonth(monthDate(days[index].timestamp)); }
  function updateVisibleMonth(event: React.UIEvent<HTMLDivElement>) { const index = Math.max(0, Math.min(days.length - 1, Math.floor(event.currentTarget.scrollLeft / GANTT_DAY_WIDTH))); setVisibleMonth(monthDate(days[index].timestamp)); }

  return <section className="gantt-shell" aria-labelledby="timeline-title">
    <div className="gantt-heading"><div><p className="eyebrow mb-2">Perencanaan waktu</p><h2 id="timeline-title" className="editorial-title text-2xl">Timeline Proyek</h2><p className="mt-2 text-xs text-muted">Kalender per hari · Sabtu dan Minggu diblok · <strong>Januari–Desember {selectedYear}</strong></p></div><div className="gantt-actions"><label className="gantt-year-filter">Tahun<select aria-label="Tahun timeline" className="control" value={selectedYear} onChange={(event) => setSelectedYear(Number(event.target.value))}>{availableYears.map((year) => <option key={year} value={year}>{year === currentYear ? `${year} (Aktif)` : year < currentYear ? `Arsip ${year}` : `${year} (Terjadwal)`}</option>)}</select></label>{selectedYear < currentYear && <span className="gantt-archive-year">Arsip tahun {selectedYear}</span>}<span className="gantt-visible-month" data-testid="gantt-visible-month">{visibleMonth}</span><Button variant="ghost" onClick={scrollToToday}>Hari ini</Button></div></div>
    <div ref={scrollRef} className="gantt-scroll" aria-label="Gantt chart timeline" onScroll={updateVisibleMonth}>
      <div className="gantt-chart" style={{ width: `${208 + timelineWidth}px` }}>
        <div className="gantt-axis" style={{ gridTemplateColumns }}><div className="gantt-task-heading">Tugas</div><div className="gantt-calendar" style={{ width: `${timelineWidth}px` }}><div className="gantt-months">{months.map((month) => <div key={month.key} style={{ width: `${month.count * GANTT_DAY_WIDTH}px` }}>{month.label}</div>)}</div><div className="gantt-days">{days.map((day) => <div key={day.timestamp} aria-label={fullDate(day.timestamp)} data-weekend={day.weekend ? "true" : "false"} className={`${day.weekend ? "is-weekend" : ""} ${day.today ? "is-today" : ""}`} style={{ width: `${GANTT_DAY_WIDTH}px` }}><span>{weekdayNames[day.weekday]}</span><strong>{day.day}</strong></div>)}</div></div></div>
        {visibleItems.map(({ card, status, start, due }) => {
          const clippedStart = Math.max(start, first);
          const clippedDue = Math.min(due, last);
          const left = Math.floor((clippedStart - first) / DAY) * GANTT_DAY_WIDTH;
          const width = Math.max(8, ((Math.floor((clippedDue - clippedStart) / DAY) + 1) * GANTT_DAY_WIDTH) - 6);
          return <div key={card.id} className="gantt-row" style={{ gridTemplateColumns }}><div className="gantt-task"><strong>{card.title}</strong><span>{status}{card.assignee ? ` · ${card.assignee}` : ""}</span></div><div className="gantt-track" style={{ width: `${timelineWidth}px`, backgroundSize: `${GANTT_DAY_WIDTH}px 100%` }}>{days.filter((day) => day.weekend || day.today).map((day) => <i key={day.timestamp} aria-hidden className={`gantt-day-block ${day.weekend ? "is-weekend" : ""} ${day.today ? "is-today" : ""}`} style={{ left: `${day.index * GANTT_DAY_WIDTH}px`, width: `${GANTT_DAY_WIDTH}px` }} />)}<span className={`gantt-bar ${priorityBarClasses[card.priority]}`} style={{ left: `${left + 3}px`, width: `${width}px` }} title={`${card.title}: ${card.start_date ?? card.due_date} – ${card.due_date ?? card.start_date}`}><span className="sr-only">{priorityNames[card.priority]}</span></span></div></div>;
        })}
        {visibleItems.length === 0 && <div className="gantt-row gantt-empty-year" style={{ gridTemplateColumns }}><div className="gantt-task"><strong>Belum ada tugas</strong><span>{selectedYear < currentYear ? "Tahun arsip" : "Tahun aktif"}</span></div><div className="gantt-track" style={{ width: `${timelineWidth}px`, backgroundSize: `${GANTT_DAY_WIDTH}px 100%` }} /></div>}
      </div>
    </div>
  </section>;
}

function PriorityTaskList({ board }: { board: Board }) {
  const tasks = board.columns.flatMap((column) => column.cards.map((raw) => ({ card: defaultCard(raw), status: column.title, done: column.title.trim().toLowerCase() === "done" }))).sort((left, right) => Number(left.done) - Number(right.done) || priorityOrder[left.card.priority] - priorityOrder[right.card.priority] || (left.card.due_date ?? "9999-12-31").localeCompare(right.card.due_date ?? "9999-12-31") || left.card.title.localeCompare(right.card.title, "id"));

  return <section className="priority-list-shell" aria-labelledby="priority-list-title"><div className="mb-4"><p className="eyebrow mb-2">Urutan pengerjaan</p><h2 id="priority-list-title" className="editorial-title text-2xl">Daftar Prioritas Tugas</h2></div>{tasks.length === 0 ? <p className="text-sm text-muted">Belum ada tugas.</p> : <ol className="priority-task-list">{tasks.map(({ card, status, done }, index) => <li key={card.id} className={done ? "is-done" : ""}><span className="task-rank">{String(index + 1).padStart(2, "0")}</span><i className={`priority-dot ${priorityBarClasses[card.priority]}`} aria-label={`Prioritas ${priorityNames[card.priority]}`} /><div className="min-w-0 flex-1"><strong>{card.title}</strong><span>{status}{card.assignee ? ` · ${card.assignee}` : ""}{card.due_date ? ` · ${card.due_date}` : ""}</span></div>{done && <span className="done-label">Selesai</span>}</li>)}</ol>}</section>;
}

function ArchivedTasks({ board, restore }: { board: Board; restore: (card: Card) => Promise<void> }) {
  const cards = board.archived_cards ?? [];
  return <section className="archive-shell" aria-label="Arsip tugas"><details><summary><span><strong>Arsip tugas Done</strong><small>{cards.length} tugas tersimpan</small></span><span aria-hidden>⌄</span></summary>{cards.length === 0 ? <p className="p-4 text-sm text-muted">Belum ada tugas yang diarsipkan.</p> : <ol className="archive-list">{cards.map((raw) => { const card = defaultCard(raw); const writable = board.workspaces.some((workspace) => workspace.id === card.workspace_id && workspace.can_write); return <li key={card.id}><i className={`priority-dot ${priorityBarClasses[card.priority]}`} aria-hidden /><div className="min-w-0 flex-1"><strong>{card.title}</strong><span>{board.workspaces.find((workspace) => workspace.id === card.workspace_id)?.name} · diarsipkan {card.archived_at ? new Date(card.archived_at).toLocaleDateString("id-ID") : "-"}</span></div>{writable && <Button variant="ghost" onClick={() => void restore(card)}>Pulihkan</Button>}</li>; })}</ol>}</details></section>;
}

function AnalyticsDashboard({ board }: { board: Board }) {
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const active = board.columns.flatMap((column) => column.cards.map((raw) => ({ card: defaultCard(raw), status: column.title, done: column.title.trim().toLowerCase() === "done", archived: false })));
  const archived = (board.archived_cards ?? []).map((raw) => ({ card: defaultCard(raw), status: "Arsip", done: true, archived: true }));
  const records = [...active, ...archived];
  const statuses = [...board.columns.map((column) => column.title), ...(archived.length ? ["Arsip"] : [])];
  const assignees = Array.from(new Set(records.map(({ card }) => card.assignee).filter((value): value is string => Boolean(value)))).sort((a, b) => a.localeCompare(b, "id"));
  const filtered = records.filter(({ card, status }) => (statusFilter === "all" || status === statusFilter) && (priorityFilter === "all" || card.priority === priorityFilter) && (assigneeFilter === "all" || card.assignee === assigneeFilter));
  const today = new Date().toISOString().slice(0, 10);
  const completed = filtered.filter((item) => item.done).length;
  const overdue = filtered.filter(({ card, done }) => !done && card.due_date && card.due_date < today).length;
  const activeCount = filtered.length - completed;
  const completion = filtered.length ? Math.round((completed / filtered.length) * 100) : 0;
  const statusStats = statuses.map((status) => ({ label: status, count: filtered.filter((item) => item.status === status).length }));
  const priorityStats = priorities.map((priority) => ({ priority, count: filtered.filter(({ card }) => card.priority === priority).length }));
  const maxStatus = Math.max(1, ...statusStats.map((item) => item.count));
  const maxPriority = Math.max(1, ...priorityStats.map((item) => item.count));

  return <section className="analytics-shell" aria-labelledby="analytics-title"><div className="analytics-heading"><div><p className="eyebrow mb-2">Ringkasan kerja</p><h2 id="analytics-title" className="editorial-title text-3xl">Dashboard Produktivitas</h2><p className="mt-2 text-sm text-muted">Metrik aktif mengikuti filter PT di atas serta filter dashboard berikut.</p></div><div className="analytics-filters"><label>Status<select aria-label="Filter status dashboard" className="control" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">Semua status</option>{statuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></label><label>Prioritas<select aria-label="Filter prioritas dashboard" className="control" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}><option value="all">Semua prioritas</option>{priorities.map((priority) => <option key={priority} value={priority}>{priorityNames[priority]}</option>)}</select></label><label>PIC<select aria-label="Filter PIC dashboard" className="control" value={assigneeFilter} onChange={(event) => setAssigneeFilter(event.target.value)}><option value="all">Semua PIC</option>{assignees.map((assignee) => <option key={assignee} value={assignee}>{assignee}</option>)}</select></label></div></div><div className="analytics-metrics"><article><span>Total terfilter</span><strong data-testid="dashboard-total">{filtered.length}</strong></article><article><span>Masih aktif</span><strong>{activeCount}</strong></article><article><span>Selesai + arsip</span><strong>{completed}</strong></article><article><span>Terlambat</span><strong>{overdue}</strong></article><article><span>Tingkat selesai</span><strong>{completion}%</strong></article></div><div className="analytics-charts"><article><h3>Distribusi status</h3><div className="analytics-bars">{statusStats.map((item) => <div key={item.label}><span>{item.label}</span><i><b style={{ width: `${(item.count / maxStatus) * 100}%` }} /></i><strong>{item.count}</strong></div>)}</div></article><article><h3>Distribusi prioritas</h3><div className="analytics-bars">{priorityStats.map((item) => <div key={item.priority}><span>{priorityNames[item.priority]}</span><i><b className={priorityBarClasses[item.priority]} style={{ width: `${(item.count / maxPriority) * 100}%` }} /></i><strong>{item.count}</strong></div>)}</div></article></div></section>;
}

export default function GlobalKanbanPage() {
  const [board, setBoard] = useState<Board | null>(null); const [error, setError] = useState("");
  const [activeCard, setActiveCard] = useState<Card | null>(null);
  const [editing, setEditing] = useState<Card | null>(null); const [detail, setDetail] = useState<Detail | null>(null); const [addingTo, setAddingTo] = useState<number | null>(null);
  const [title, setTitle] = useState(""); const [description, setDescription] = useState(""); const [workspaceId, setWorkspaceId] = useState(0); const [assignee, setAssignee] = useState(""); const [priority, setPriority] = useState<CardPriority>("medium"); const [startDate, setStartDate] = useState(""); const [dueDate, setDueDate] = useState(""); const [labels, setLabels] = useState(""); const [filter, setFilter] = useState("all");
  const [checkText, setCheckText] = useState(""); const [linkTitle, setLinkTitle] = useState(""); const [linkUrl, setLinkUrl] = useState(""); const [commentAuthor, setCommentAuthor] = useState(""); const [commentBody, setCommentBody] = useState("");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }), useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }), useSensor(KeyboardSensor));
  const load = useCallback(() => api<Board>("/kanban").then((value) => { setBoard(value); setError(""); }).catch((reason) => setError(reason instanceof Error ? reason.message : "Kanban gagal dimuat.")), []);
  useEffect(() => { void load(); }, [load]);
  const loadDetail = useCallback((id: number) => api<Detail>(`/kanban/cards/${id}`).then(setDetail), []);
  async function mutate(card: Card, values: Partial<Card>) { try { await api(`/kanban/cards/${card.id}`, { method: "PATCH", ...jsonBody(values) }); await load(); if (editing?.id === card.id) await loadDetail(card.id); setError(""); return true; } catch (reason) { setError(reason instanceof Error ? reason.message : "Perubahan kartu gagal."); return false; } }
  async function remove(card: Card) { try { await api(`/kanban/cards/${card.id}`, { method: "DELETE" }); await load(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Kartu gagal dihapus."); } }
  async function archiveDone(cards: Card[]) { try { for (const card of cards) await api(`/kanban/cards/${card.id}/archive`, { method: "POST" }); await load(); setError(""); } catch (reason) { setError(reason instanceof Error ? reason.message : "Tugas selesai gagal diarsipkan."); } }
  async function restore(card: Card) { try { await api(`/kanban/cards/${card.id}/restore`, { method: "POST" }); await load(); setError(""); } catch (reason) { setError(reason instanceof Error ? reason.message : "Tugas gagal dipulihkan."); } }
  function close() { setEditing(null); setDetail(null); setAddingTo(null); }
  function openAdd(columnId: number) { const workspace = board?.workspaces.find((w) => w.can_write); setAddingTo(columnId); setEditing(null); setDetail(null); setTitle(""); setDescription(""); setWorkspaceId(workspace?.id ?? 0); setAssignee(""); setPriority("medium"); setStartDate(""); setDueDate(""); setLabels(""); }
  function openEdit(card: Card) { const value = defaultCard(card); setEditing(value); setAddingTo(null); setTitle(value.title); setDescription(value.description ?? ""); setWorkspaceId(value.workspace_id); setAssignee(value.assignee ?? ""); setPriority(value.priority); setStartDate(value.start_date ?? ""); setDueDate(value.due_date ?? ""); setLabels(value.labels.join(", ")); void loadDetail(value.id).catch((reason) => setError(reason instanceof Error ? reason.message : "Detail gagal dimuat.")); }
  async function save(event: FormEvent) { event.preventDefault(); const values = { title, description: description || null, workspace_id: workspaceId, assignee: assignee || null, priority, start_date: startDate || null, due_date: dueDate || null, labels: labels.split(",").map((x) => x.trim()).filter(Boolean) }; if (editing) { if (!await mutate(editing, values)) return; } else if (addingTo) { try { await api("/kanban/cards", { method: "POST", ...jsonBody({ ...values, column_id: addingTo }) }); await load(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Kartu gagal dibuat."); return; } } close(); }
  async function nested(path: string, init: RequestInit) { if (!editing) return; try { await api(`/kanban/cards/${editing.id}${path}`, init); await Promise.all([loadDetail(editing.id), load()]); setError(""); } catch (reason) { setError(reason instanceof Error ? reason.message : "Perubahan detail gagal."); } }
  function onDragStart(event: DragStartEvent) { setActiveCard((event.active.data.current?.card as Card | undefined) ?? null); }
  async function onDragEnd(event: DragEndEvent) { const card = event.active.data.current?.card as Card | undefined; setActiveCard(null); if (!card || !event.over || !board) return; const over = event.over.data.current?.card as Card | undefined; const columnId = over?.column_id ?? Number(String(event.over.id).replace("column-", "")); const column = board.columns.find((value) => value.id === columnId); if (!column?.can_move_into) return; const overIndex = over ? column.cards.findIndex((value) => value.id === over.id) : column.cards.length; const position = overIndex < 0 ? column.cards.length : overIndex; const previous = board; setBoard(moveCardInBoard(board, card.id, columnId, position)); try { await api(`/kanban/cards/${card.id}`, { method: "PATCH", ...jsonBody({ column_id: columnId, position }) }); setBoard(await api<Board>("/kanban")); setError(""); } catch (reason) { setBoard(previous); setError(reason instanceof Error ? reason.message : "Kartu gagal dipindahkan."); } }
  if (!board) return error ? <div role="alert" className="error-box">{error}<Button onClick={load}>Coba lagi</Button></div> : <Skeleton className="h-96" />;
  const visible = { ...board, columns: board.columns.map((c) => ({ ...c, cards: filter === "all" ? c.cards : c.cards.filter((card) => card.workspace_id === Number(filter)) })), archived_cards: (board.archived_cards ?? []).filter((card) => filter === "all" || card.workspace_id === Number(filter)) };
  return <div><PageHeader eyebrow="Derajat Salim Wibowo" title="Kanban" description="Tugas, jadwal, dan progres Anda dalam satu tempat." />{error && <p role="alert" className="error-box mb-4">{error}</p>}<div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><PriorityLegend /><div><label className="label" htmlFor="workspace-filter">Filter PT</label><select id="workspace-filter" className="control min-w-48" value={filter} onChange={(e) => setFilter(e.target.value)}><option value="all">Semua PT</option>{board.workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></div></div><DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragCancel={() => setActiveCard(null)} onDragEnd={onDragEnd}><div className="kanban-board" aria-label="Papan kanban global">{visible.columns.map((column) => <BoardColumn key={column.id} column={column} board={board} mutate={mutate} edit={openEdit} remove={remove} add={openAdd} archiveDone={archiveDone} />)}</div><DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(.2,.8,.2,1)" }}>{activeCard ? <DragCardPreview card={defaultCard(activeCard)} /> : null}</DragOverlay></DndContext><GanttTimeline board={visible} /><PriorityTaskList board={visible} /><ArchivedTasks board={visible} restore={restore} /><AnalyticsDashboard board={visible} />
    {(editing || addingTo) && <ModalFrame titleId="card-form-title" onClose={close} initialFocusSelector="#card-title" className="max-w-4xl"><div className="max-h-[85vh] overflow-y-auto p-1"><form onSubmit={save} className="space-y-4"><h2 id="card-form-title" className="editorial-title text-2xl">{editing ? "Detail kartu" : "Kartu baru"}</h2><div className="grid gap-4 md:grid-cols-2"><div><label className="label" htmlFor="card-title">Judul</label><input id="card-title" required maxLength={240} className="control" value={title} onChange={(e) => setTitle(e.target.value)} /></div><div><label className="label" htmlFor="card-workspace">Workspace / PT</label><select id="card-workspace" className="control" value={workspaceId} onChange={(e) => setWorkspaceId(Number(e.target.value))}>{board.workspaces.filter((w) => w.can_write).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></div><div><label className="label" htmlFor="card-assignee">PIC</label><input id="card-assignee" className="control" value={assignee} onChange={(e) => setAssignee(e.target.value)} /></div><div><label className="label" htmlFor="card-priority">Prioritas</label><select id="card-priority" className="control" value={priority} onChange={(e) => setPriority(e.target.value as CardPriority)}>{Object.entries(priorityNames).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></div><div><label className="label" htmlFor="card-start">Tanggal mulai</label><input id="card-start" type="date" className="control" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div><div><label className="label" htmlFor="card-due">Deadline</label><input id="card-due" type="date" className="control" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div></div><label className="label" htmlFor="card-labels">Label (pisahkan koma)</label><input id="card-labels" className="control" value={labels} onChange={(e) => setLabels(e.target.value)} /><label className="label" htmlFor="card-description">Deskripsi</label><textarea id="card-description" maxLength={10000} className="control min-h-28" value={description} onChange={(e) => setDescription(e.target.value)} /><div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={close}>Batal</Button><Button type="submit">Simpan</Button></div></form>
      {editing && detail?.checklist_items && <div className="mt-8 grid gap-8 border-t border-line pt-6 md:grid-cols-2"><section><h3 className="font-semibold">Checklist ({detail.checklist_completed}/{detail.checklist_total})</h3><div className="mt-3 space-y-2">{detail.checklist_items.map((item) => <div key={item.id} className="flex items-center gap-2"><input aria-label={`Selesai ${item.text}`} type="checkbox" checked={item.is_completed} onChange={(e) => void nested(`/checklist/${item.id}`, { method: "PATCH", ...jsonBody({ is_completed: e.target.checked }) })} /><span className={item.is_completed ? "line-through" : ""}>{item.text}</span><button type="button" className="ml-auto text-xs" onClick={() => void nested(`/checklist/${item.id}`, { method: "DELETE" })}>Hapus</button></div>)}</div><form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); void nested("/checklist", { method: "POST", ...jsonBody({ text: checkText }) }); setCheckText(""); }}><input aria-label="Checklist baru" required className="control" value={checkText} onChange={(e) => setCheckText(e.target.value)} /><Button type="submit">Tambah</Button></form></section><section><h3 className="font-semibold">Lampiran / tautan</h3>{detail.attachments.map((item) => <div key={item.id} className="mt-2 flex gap-2"><a className="underline" target="_blank" rel="noreferrer" href={item.url}>{item.title}</a><button type="button" onClick={() => void nested(`/attachments/${item.id}`, { method: "DELETE" })}>Hapus</button></div>)}<form className="mt-3 space-y-2" onSubmit={(e) => { e.preventDefault(); void nested("/attachments", { method: "POST", ...jsonBody({ title: linkTitle, url: linkUrl }) }); setLinkTitle(""); setLinkUrl(""); }}><input aria-label="Judul lampiran" required className="control" value={linkTitle} onChange={(e) => setLinkTitle(e.target.value)} /><input aria-label="URL lampiran" required type="url" className="control" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} /><Button type="submit">Tambah lampiran</Button></form></section><section><h3 className="font-semibold">Komentar</h3>{detail.comments.map((item) => <article key={item.id} className="mt-2 rounded border border-line p-3"><strong>{item.author}</strong><p>{item.body}</p><time className="text-xs text-muted">{new Date(item.created_at).toLocaleString("id-ID")}</time></article>)}<form className="mt-3 space-y-2" onSubmit={(e) => { e.preventDefault(); void nested("/comments", { method: "POST", ...jsonBody({ author: commentAuthor, body: commentBody }) }); setCommentBody(""); }}><input aria-label="Nama pemberi komentar" required className="control" value={commentAuthor} onChange={(e) => setCommentAuthor(e.target.value)} /><textarea aria-label="Komentar baru" required className="control" value={commentBody} onChange={(e) => setCommentBody(e.target.value)} /><Button type="submit">Kirim komentar</Button></form></section><section><h3 className="font-semibold">Aktivitas</h3><ol className="mt-2 space-y-2 text-sm">{detail.activities.slice().reverse().map((item) => <li key={item.id}><strong>{item.actor}</strong> — {item.detail}<br/><time className="text-xs text-muted">{new Date(item.created_at).toLocaleString("id-ID")}</time></li>)}</ol><p className="mt-3 text-xs text-muted">Dibuat {new Date(detail.created_at).toLocaleString("id-ID")} · diperbarui {new Date(detail.updated_at).toLocaleString("id-ID")}</p></section></div>}</div></ModalFrame>}
  </div>;
}

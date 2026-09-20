import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProjectsPage from "@/app/(protected)/workspaces/[slug]/projects/page";
import GlobalKanbanPage from "@/app/(protected)/kanban/page";
import { api } from "@/lib/api";

vi.mock("next/navigation", () => ({ useParams: () => ({ slug: "bisa-ai" }) }));
vi.mock("@/lib/api", () => ({ api: vi.fn(), jsonBody: (value: unknown) => ({ body: JSON.stringify(value) }) }));
const apiMock = vi.mocked(api);

describe("Kanban projects", () => {
  beforeEach(() => apiMock.mockReset());

  it("loads a board and adds a column with Indonesian controls", async () => {
    apiMock.mockImplementation(async (path, init) => {
      if (path === "/workspaces/bisa-ai") return { id: 1, name: "PT BISA AI", slug: "bisa-ai", role: "owner", modules: [] };
      if (path === "/workspaces/1/kanban" && !init) return { columns: [] };
      if (path === "/workspaces/1/kanban/columns") return { id: 9, workspace_id: 1, title: "Rencana", position: 0, cards: [] };
      return [];
    });
    render(<ProjectsPage />);
    expect(await screen.findByRole("heading", { name: "Papan Proyek" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Judul kolom baru"), { target: { value: "Rencana" } });
    fireEvent.click(screen.getByRole("button", { name: "Tambah kolom" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Rencana" })).toBeInTheDocument());
  });

  it("provides accessible controls to move cards between columns", async () => {
    apiMock.mockImplementation(async (path) => {
      if (path === "/workspaces/bisa-ai") return { id: 1, name: "PT BISA AI", slug: "bisa-ai", role: "owner", modules: [] };
      if (path === "/workspaces/1/kanban") return { columns: [
        { id: 1, title: "Masuk", position: 0, cards: [{ id: 3, column_id: 1, title: "Tugas", description: null, position: 0 }] },
        { id: 2, title: "Selesai", position: 1, cards: [] },
      ] };
      if (path === "/workspaces/1/kanban/cards/3") return { id: 3, column_id: 2, title: "Tugas", description: null, position: 0 };
      return [];
    });
    render(<ProjectsPage />);
    expect(await screen.findByText("Tugas")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Pindahkan Tugas"), { target: { value: "2" } });
    await waitFor(() => expect(apiMock).toHaveBeenCalledWith("/workspaces/1/kanban/cards/3", expect.objectContaining({ method: "PATCH" })));
  });
});

describe("Kanban global", () => {
  beforeEach(() => apiMock.mockReset());
  it("menampilkan lima status baku dan filter PT dengan Semua PT sebagai default", async () => {
    apiMock.mockResolvedValue({
      workspaces: [{ id: 1, name: "PT Satu", slug: "satu", role: "owner", can_write: true }, { id: 2, name: "PT Dua", slug: "dua", role: "admin", can_write: true }],
      columns: ["Backlog", "To Do", "In Progress", "Review", "Done"].map((title, position) => ({ id: position + 1, workspace_id: null, title, position, can_write: true, can_create: true, can_move_into: true, cards: position === 0 ? [{ id: 10, column_id: 1, workspace_id: 1, title: "Milik Satu", description: null, position: 0 }, { id: 11, column_id: 1, workspace_id: 2, title: "Milik Dua", description: null, position: 1 }] : [] })),
    });
    render(<GlobalKanbanPage />);
    const kanban = await screen.findByLabelText("Papan kanban global");
    expect(screen.getByText("Derajat Salim Wibowo")).toBeInTheDocument();
    expect(screen.queryByText("Semua ruang kerja")).not.toBeInTheDocument();
    expect(within(kanban).getAllByRole("heading", { level: 2 })).toHaveLength(5);
    const filter = screen.getByLabelText("Filter PT");
    expect(filter).toHaveValue("all");
    fireEvent.change(filter, { target: { value: "1" } });
    expect(within(kanban).getByText("Milik Satu")).toBeInTheDocument();
    expect(within(kanban).queryByText("Milik Dua")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Backlog" }).closest("section")).toHaveTextContent("1");
  });
  it("menyediakan delegasi dan drag tanpa dropdown pindahkan", async () => {
    apiMock.mockResolvedValue({
      workspaces: [
        { id: 1, name: "PT Asal", slug: "asal", role: "owner", can_write: true },
        { id: 2, name: "PT Tujuan", slug: "tujuan", role: "admin", can_write: true },
      ],
      columns: [{ id: 4, workspace_id: 1, title: "Masuk", position: 0, can_write: true, can_create: true, can_move_into: true, cards: [
        { id: 7, column_id: 4, workspace_id: 1, title: "Judul tugas global yang panjang dan harus terbaca penuh", description: null, position: 0 },
      ] }],
    });
    render(<GlobalKanbanPage />);
    expect(await screen.findByRole("heading", { name: "Kanban" })).toBeInTheDocument();
    const title = within(screen.getByLabelText("Papan kanban global")).getByText("Judul tugas global yang panjang dan harus terbaca penuh");
    expect(title).not.toHaveClass("truncate");
    expect(screen.getByLabelText("Delegasikan Judul tugas global yang panjang dan harus terbaca penuh")).toBeInTheDocument();
    expect(screen.getByLabelText("Seret Judul tugas global yang panjang dan harus terbaca penuh")).toBeInTheDocument();
    expect(screen.queryByLabelText(/Pindahkan/)).not.toBeInTheDocument();
  });

  it("menampilkan legenda dan daftar prioritas dengan tugas Done dicoret", async () => {
    apiMock.mockResolvedValue({
      workspaces: [{ id: 1, name: "PT Asal", slug: "asal", role: "owner", can_write: true }],
      columns: [
        { id: 4, workspace_id: null, title: "To Do", position: 0, can_write: true, can_create: true, can_move_into: true, cards: [
          { id: 1, column_id: 4, workspace_id: 1, title: "Prioritas rendah", description: null, position: 0, priority: "low" },
          { id: 2, column_id: 4, workspace_id: 1, title: "Mendesak dulu", description: null, position: 1, priority: "urgent" },
        ] },
        { id: 5, workspace_id: null, title: "Done", position: 1, can_write: true, can_create: true, can_move_into: true, cards: [
          { id: 3, column_id: 5, workspace_id: 1, title: "Sudah selesai", description: null, position: 0, priority: "high" },
        ] },
      ],
    });
    render(<GlobalKanbanPage />);
    const legend = await screen.findByLabelText("Legenda prioritas");
    expect(legend).toHaveTextContent("MendesakTinggiSedangRendah");
    const list = screen.getByRole("heading", { name: "Daftar Prioritas Tugas" }).closest("section")!;
    const tasks = within(list).getAllByRole("listitem");
    expect(tasks[0]).toHaveTextContent("Mendesak dulu");
    expect(tasks[1]).toHaveTextContent("Prioritas rendah");
    expect(tasks[2]).toHaveTextContent("Sudah selesai");
    expect(tasks[2]).toHaveClass("is-done");
  });

  it("menampilkan arsip dan dashboard interaktif dengan filter", async () => {
    apiMock.mockResolvedValue({
      workspaces: [{ id: 1, name: "PT Asal", slug: "asal", role: "owner", can_write: true }],
      archived_cards: [{ id: 8, column_id: 5, workspace_id: 1, title: "Arsip lama", description: null, position: -8, priority: "medium", archived_at: "2026-09-14T10:00:00Z" }],
      columns: [
        { id: 1, workspace_id: null, title: "Backlog", position: 0, can_write: true, can_create: true, can_move_into: true, cards: [{ id: 1, column_id: 1, workspace_id: 1, title: "Aktif", description: null, position: 0, priority: "urgent", assignee: "Ayu" }] },
        { id: 5, workspace_id: null, title: "Done", position: 4, can_write: true, can_create: true, can_move_into: true, cards: [{ id: 2, column_id: 5, workspace_id: 1, title: "Selesai", description: null, position: 0, priority: "low", assignee: "Budi" }] },
      ],
    });
    render(<GlobalKanbanPage />);
    const archiveButton = await screen.findByRole("button", { name: "Arsipkan semua tugas Done" });
    expect(archiveButton).toBeInTheDocument();
    fireEvent.click(archiveButton);
    await waitFor(() => expect(apiMock).toHaveBeenCalledWith("/kanban/cards/2/archive", { method: "POST" }));
    expect(screen.getByRole("heading", { name: "Dashboard Produktivitas" })).toBeInTheDocument();
    expect(screen.getByLabelText("Filter status dashboard")).toHaveValue("all");
    expect(screen.getByLabelText("Filter prioritas dashboard")).toHaveValue("all");
    expect(screen.getByLabelText("Filter PIC dashboard")).toHaveValue("all");
    expect(screen.getByText("Arsip lama")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Filter PIC dashboard"), { target: { value: "Ayu" } });
    expect(screen.getByTestId("dashboard-total")).toHaveTextContent("1");
  });

  it("menampilkan Gantt harian tahun 2026 dan bulan aktif mengikuti scroll", async () => {
    apiMock.mockResolvedValue({
      workspaces: [{ id: 1, name: "PT Asal", slug: "asal", role: "owner", can_write: true }],
      archived_cards: [],
      columns: [{ id: 1, workspace_id: null, title: "To Do", position: 0, can_write: true, can_create: true, can_move_into: true, cards: [
        { id: 9, column_id: 1, workspace_id: 1, title: "Rentang akhir pekan", description: null, position: 0, priority: "high", start_date: "2026-09-11", due_date: "2026-09-14" },
        { id: 10, column_id: 1, workspace_id: 1, title: "Tugas lama", description: null, position: 1, priority: "low", start_date: "2025-12-01", due_date: "2025-12-02" },
      ] }],
    });
    render(<GlobalKanbanPage />);
    expect(await screen.findByLabelText("Sabtu, 12 September 2026")).toHaveAttribute("data-weekend", "true");
    expect(screen.getByLabelText("Minggu, 13 September 2026")).toHaveAttribute("data-weekend", "true");
    expect(screen.getByText("Januari–Desember 2026")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tambah 12 bulan" })).not.toBeInTheDocument();
    const timeline = screen.getByLabelText("Gantt chart timeline");
    await waitFor(() => expect(timeline.scrollLeft).toBeGreaterThan(0));
    const year = screen.getByLabelText("Tahun timeline");
    expect(year).toHaveValue("2026");
    expect(year).toHaveTextContent("2026 (Aktif)");
    expect(year).toHaveTextContent("Arsip 2025");
    timeline.scrollLeft = 31 * 34;
    fireEvent.scroll(timeline);
    expect(screen.getByTestId("gantt-visible-month")).toHaveTextContent("Februari 2026");
    fireEvent.change(year, { target: { value: "2025" } });
    expect(screen.getByText("Arsip tahun 2025")).toBeInTheDocument();
  });

  it("clears a stale load error after retry succeeds", async () => {
    apiMock
      .mockRejectedValueOnce(new Error("Jaringan putus"))
      .mockResolvedValueOnce({ workspaces: [], columns: [] });
    render(<GlobalKanbanPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Jaringan putus");

    fireEvent.click(screen.getByRole("button", { name: "Coba lagi" }));

    expect(await screen.findByRole("heading", { name: "Kanban" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("traps modal focus, closes with Escape, and restores the trigger", async () => {
    apiMock.mockResolvedValue({
      workspaces: [{ id: 1, name: "PT Asal", slug: "asal", role: "owner", can_write: true }],
      columns: [{ id: 4, workspace_id: 1, title: "Masuk", position: 0, can_write: true, can_create: true, can_move_into: true, cards: [] }],
    });
    render(<GlobalKanbanPage />);
    const trigger = await screen.findByRole("button", { name: "Tambah kartu" });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog");
    const title = screen.getByLabelText("Judul");
    expect(title).toHaveFocus();
    const save = screen.getByRole("button", { name: "Simpan" });
    save.focus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(title).toHaveFocus();

    fireEvent.keyDown(dialog, { key: "Escape" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("keeps the edit dialog open and reports a save failure", async () => {
    apiMock.mockResolvedValue({
        workspaces: [{ id: 1, name: "PT Asal", slug: "asal", role: "owner", can_write: true }],
        columns: [{ id: 4, workspace_id: 1, title: "Masuk", position: 0, can_write: true, can_create: true, can_move_into: true, cards: [
          { id: 7, column_id: 4, workspace_id: 1, title: "Gagal edit", description: null, position: 0 },
        ] }],
    });
    render(<GlobalKanbanPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Edit kartu" }));
    apiMock.mockRejectedValueOnce(new Error("Tidak tersimpan"));
    fireEvent.submit(screen.getByRole("dialog").querySelector("form")!);

    expect(await screen.findByRole("alert")).toHaveTextContent("Tidak tersimpan");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("shows concise metadata and opens the detailed card modal", async () => {
    const card = { id: 7, column_id: 4, workspace_id: 1, title: "Rilis", description: "Panjang", position: 0, assignee: "Ayu", priority: "urgent", due_date: "2026-09-20", start_date: "2026-09-14", labels: ["Rilis"], checklist_total: 2, checklist_completed: 1, created_at: "2026-09-14T10:00:00Z", updated_at: "2026-09-14T11:00:00Z" };
    apiMock.mockImplementation(async (path) => {
      if (path === "/kanban/cards/7") return { ...card, checklist_items: [{ id: 1, text: "Uji", is_completed: false, position: 0, created_at: card.created_at, updated_at: card.updated_at }], attachments: [{ id: 2, title: "Spec", url: "https://example.com", created_at: card.created_at, updated_at: card.updated_at }], comments: [{ id: 3, author: "Ayu", body: "Siap", created_at: card.created_at, updated_at: card.updated_at }], activities: [{ id: 4, actor: "Ayu", action: "created", detail: "Kartu dibuat", created_at: card.created_at }] };
      return { workspaces: [{ id: 1, name: "PT Asal", slug: "asal", role: "owner", can_write: true }], columns: [{ id: 4, workspace_id: null, title: "Backlog", position: 0, can_write: true, can_create: true, can_move_into: true, cards: [card] }] };
    });
    render(<GlobalKanbanPage />);
    expect(await screen.findByText("PIC: Ayu")).toBeInTheDocument();
    expect(screen.getByText("Checklist: 1/2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit kartu" }));
    expect(await screen.findByRole("heading", { name: "Detail kartu" })).toBeInTheDocument();
    expect(await screen.findByText("Uji")).toBeInTheDocument();
    expect(screen.getByText("Spec")).toBeInTheDocument();
    expect(screen.getByText("Siap")).toBeInTheDocument();
    expect(screen.getByText(/Kartu dibuat/)).toBeInTheDocument();
  });

  it("keeps the create dialog open and reports a create failure", async () => {
    apiMock.mockResolvedValue({
        workspaces: [{ id: 1, name: "PT Asal", slug: "asal", role: "owner", can_write: true }],
        columns: [{ id: 4, workspace_id: 1, title: "Masuk", position: 0, can_write: true, can_create: true, can_move_into: true, cards: [] }],
    });
    render(<GlobalKanbanPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Tambah kartu" }));
    fireEvent.change(screen.getByLabelText("Judul"), { target: { value: "Baru" } });
    apiMock.mockRejectedValueOnce(new Error("Tidak dibuat"));
    fireEvent.submit(screen.getByRole("dialog").querySelector("form")!);

    expect(await screen.findByRole("alert")).toHaveTextContent("Tidak dibuat");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});

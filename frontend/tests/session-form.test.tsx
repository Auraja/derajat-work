import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SessionForm } from "@/components/session-form";
import { api } from "@/lib/api";
import type { TeachingSession } from "@/lib/types";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useParams: () => ({ slug: "bisa-ai" }),
  useRouter: () => ({ back: vi.fn(), push, refresh: vi.fn() }),
}));
vi.mock("@/lib/api", () => ({ api: vi.fn() }));
vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ show: vi.fn() }),
}));

const apiMock = vi.mocked(api);

const existingSession = {
  id: 7,
  workspace_id: 3,
  created_by_id: 1,
  created_at: "2026-09-08T10:00:00Z",
  updated_at: "2026-09-08T10:00:00Z",
  title: "Sesi tersimpan",
  topic: "AI",
  description: "Deskripsi",
  audience: "Umum",
  location: "Lab 2",
  participant_count: 20,
  participant_label: "Mahasiswa",
  source: "external_ai",
  difficulty: "intermediate",
  instructor: null,
  instructors: ["Ayu", "Bima"],
  activities: [
    { type: "workshop", startDate: "2026-09-10", endDate: "2026-09-11", mode: null },
    { type: "mentoring", startDate: "2026-09-15", endDate: "2026-09-15", mode: "online" },
  ],
  scheduled_at: null,
  duration_minutes: 120,
  session_type: "class",
  session_date: "2026-09-10",
  status: "scheduled",
  notes: "Catatan",
  module_id: null,
} satisfies TeachingSession;

describe("SessionForm", () => {
  beforeEach(() => {
    apiMock.mockReset();
    push.mockReset();
    apiMock.mockResolvedValue({ id: 3, name: "BISA AI", slug: "bisa-ai" });
  });

  it("shows a retry action when workspace loading fails", async () => {
    apiMock.mockReset();
    apiMock.mockRejectedValueOnce(new Error("Ruang tidak tersedia"));

    render(<SessionForm />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Ruang tidak tersedia");
    expect(screen.getByRole("button", { name: "Buat sesi" })).toBeDisabled();

    apiMock.mockResolvedValue({ id: 3, name: "BISA AI", slug: "bisa-ai" });
    fireEvent.click(screen.getByRole("button", { name: "Coba lagi" }));

    expect(await screen.findByRole("button", { name: "Buat sesi" })).toBeEnabled();
  });

  it("builds the manual API contract with instructors and an activity", async () => {
    apiMock.mockImplementation(async (path, options) => {
      if (path === "/workspaces/bisa-ai") return { id: 3, name: "BISA AI", slug: "bisa-ai" };
      if (options?.method === "POST") return { id: 9 };
      throw new Error("Permintaan tidak diharapkan");
    });
    render(<SessionForm />);
    await screen.findByRole("button", { name: "Buat sesi" });

    fireEvent.change(screen.getByLabelText("Judul"), { target: { value: "Kelas AI" } });
    fireEvent.change(screen.getByLabelText("Jenis sesi"), { target: { value: "workshop" } });
    fireEvent.change(screen.getByLabelText("Pengajar"), { target: { value: "Ayu, Bima" } });
    fireEvent.change(screen.getByLabelText("Tanggal mulai"), { target: { value: "2026-10-10" } });
    fireEvent.change(screen.getByLabelText("Tanggal selesai"), { target: { value: "2026-10-11" } });
    fireEvent.change(screen.getByLabelText("Mode"), { target: { value: "offline" } });
    fireEvent.change(screen.getByLabelText("Lokasi"), { target: { value: "Lab 2" } });
    fireEvent.change(screen.getByLabelText("Jumlah peserta"), { target: { value: "24" } });
    fireEvent.change(screen.getByLabelText("Label peserta"), { target: { value: "Mahasiswa" } });
    fireEvent.change(screen.getByLabelText("Audiens"), { target: { value: "Semester 3" } });
    fireEvent.submit(screen.getByRole("button", { name: "Buat sesi" }).closest("form")!);

    await waitFor(() => expect(apiMock).toHaveBeenCalledWith(
      "/workspaces/3/teaching/sessions",
      expect.objectContaining({ method: "POST" }),
    ));
    const call = apiMock.mock.calls.find(([, options]) => options?.method === "POST")!;
    expect(JSON.parse(String(call[1]?.body))).toMatchObject({
      title: "Kelas AI",
      session_type: "workshop",
      instructors: ["Ayu", "Bima"],
      location: "Lab 2",
      participant_count: 24,
      participant_label: "Mahasiswa",
      audience: "Semester 3",
      activities: [{ type: "workshop", startDate: "2026-10-10", endDate: "2026-10-11", mode: "offline" }],
    });
    expect(JSON.parse(String(call[1]?.body))).not.toHaveProperty("source");
    expect(push).toHaveBeenCalledWith("/workspaces/bisa-ai/teaching-sessions/9");
  });

  it("rejects an end date before the start date without posting", async () => {
    render(<SessionForm />);
    await screen.findByRole("button", { name: "Buat sesi" });
    fireEvent.change(screen.getByLabelText("Judul"), { target: { value: "Kelas AI" } });
    fireEvent.change(screen.getByLabelText("Pengajar"), { target: { value: "Ayu" } });
    fireEvent.change(screen.getByLabelText("Tanggal mulai"), { target: { value: "2026-10-11" } });
    fireEvent.change(screen.getByLabelText("Tanggal selesai"), { target: { value: "2026-10-10" } });
    fireEvent.submit(screen.getByRole("button", { name: "Buat sesi" }).closest("form")!);

    expect(await screen.findByRole("alert")).toHaveTextContent("Tanggal selesai tidak boleh sebelum tanggal mulai.");
    expect(apiMock.mock.calls.some(([, options]) => options?.method === "POST")).toBe(false);
  });

  it("populates the first activity and preserves additional activities on edit", async () => {
    apiMock.mockResolvedValue({ ...existingSession, title: "Sesi diperbarui" });
    render(<SessionForm session={existingSession} />);

    expect(apiMock).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue("Ayu, Bima")).toBeInTheDocument();
    expect(screen.getByLabelText("Jenis sesi")).toHaveValue("workshop");
    expect(screen.getByLabelText("Tanggal mulai")).toHaveValue("2026-09-10");
    expect(screen.getByLabelText("Tanggal selesai")).toHaveValue("2026-09-11");
    fireEvent.change(screen.getByLabelText("Tanggal selesai"), { target: { value: "2026-09-12" } });
    fireEvent.submit(screen.getByRole("button", { name: "Simpan perubahan" }).closest("form")!);

    await waitFor(() => expect(apiMock).toHaveBeenCalledWith(
      "/teaching/sessions/7",
      expect.objectContaining({ method: "PATCH" }),
    ));
    const payload = JSON.parse(String(apiMock.mock.calls[0][1]?.body));
    expect(payload.activities).toEqual([
      { type: "workshop", startDate: "2026-09-10", endDate: "2026-09-12", mode: null },
      existingSession.activities[1],
    ]);
    expect(payload).not.toHaveProperty("source");
  });

  it("maps a legacy scheduled_at into editable dates and keeps its time when the date changes", async () => {
    const legacySession: TeachingSession = {
      ...existingSession,
      activities: [],
      session_date: null,
      scheduled_at: "2026-09-10T09:30:00Z",
    };
    apiMock.mockResolvedValue({ ...legacySession, title: "Legacy diperbarui" });
    render(<SessionForm session={legacySession} />);

    expect(screen.getByLabelText("Tanggal mulai")).toHaveValue("2026-09-10");
    expect(screen.getByLabelText("Tanggal selesai")).toHaveValue("2026-09-10");
    fireEvent.change(screen.getByLabelText("Tanggal mulai"), { target: { value: "2026-09-12" } });
    fireEvent.change(screen.getByLabelText("Tanggal selesai"), { target: { value: "2026-09-12" } });
    fireEvent.submit(screen.getByRole("button", { name: "Simpan perubahan" }).closest("form")!);

    await waitFor(() => expect(apiMock).toHaveBeenCalled());
    const payload = JSON.parse(String(apiMock.mock.calls[0][1]?.body));
    expect(payload.scheduled_at).toBe("2026-09-12T09:30:00Z");
  });

  it("keeps optional teaching details collapsed initially", () => {
    render(<SessionForm session={existingSession} />);
    const details = screen.getByText("Detail opsional").closest("details");
    expect(details).not.toHaveAttribute("open");
    for (const label of ["Topik", "Tingkat kesulitan", "Durasi (menit)", "Deskripsi", "Catatan"]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
  });

  it("offers every teaching-session status accepted by the backend", () => {
    render(<SessionForm session={existingSession} />);
    const status = screen.getByLabelText("Status");
    expect(status.querySelector('option[value="scheduled"]')).not.toBeNull();
    expect(status.querySelector('option[value="in_progress"]')).not.toBeNull();
    expect(status.querySelector('option[value="cancelled"]')).not.toBeNull();
    expect(status.querySelector('option[value="archived"]')).toBeNull();
  });
});

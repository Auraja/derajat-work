import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SessionForm } from "@/components/session-form";
import { api } from "@/lib/api";
import type { TeachingSession } from "@/lib/types";

vi.mock("next/navigation", () => ({
  useParams: () => ({ slug: "bisa-ai" }),
  useRouter: () => ({ back: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/lib/api", () => ({ api: vi.fn() }));
vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ show: vi.fn() }),
}));

const apiMock = vi.mocked(api);

describe("SessionForm", () => {
  beforeEach(() => {
    apiMock.mockReset();
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

  it("edits a resolved session without repeating the workspace lookup", () => {
    const session = {
      id: 7,
      workspace_id: 3,
      created_by_id: 1,
      created_at: "2026-09-08T10:00:00Z",
      updated_at: "2026-09-08T10:00:00Z",
      title: "Sesi tersimpan",
      topic: null,
      description: null,
      audience: null,
      difficulty: null,
      instructor: null,
      instructors: [],
      activities: [],
      scheduled_at: null,
      duration_minutes: 60,
      session_type: null,
      session_date: null,
      status: "draft",
      notes: null,
      module_id: null,
    } satisfies TeachingSession;

    render(<SessionForm session={session} />);

    expect(apiMock).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Simpan perubahan" })).toBeEnabled();
  });

  it("offers every teaching-session status accepted by the backend", () => {
    render(<SessionForm />);

    const status = screen.getByLabelText("Status");
    expect(status.querySelector('option[value="scheduled"]')).not.toBeNull();
    expect(status.querySelector('option[value="in_progress"]')).not.toBeNull();
    expect(status.querySelector('option[value="cancelled"]')).not.toBeNull();
    expect(status.querySelector('option[value="archived"]')).toBeNull();
  });

  it("labels every field in Indonesian", () => {
    render(<SessionForm />);

    for (const label of [
      "Judul",
      "Topik",
      "Audiens",
      "Tingkat kesulitan",
      "Durasi (menit)",
      "Jenis sesi",
      "Tanggal sesi (opsional)",
      "Status",
      "Deskripsi",
      "Catatan",
    ]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
  });
});

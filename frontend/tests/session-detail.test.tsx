import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SessionDetail from "@/app/(protected)/workspaces/[slug]/teaching-sessions/[id]/page";
import { api } from "@/lib/api";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useParams: () => ({ slug: "bisa-ai", id: "7" }),
  useRouter: () => ({ replace, refresh: vi.fn() }),
}));
vi.mock("@/lib/api", () => ({ api: vi.fn() }));
vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ show }),
}));

const apiMock = vi.mocked(api);
const show = vi.fn();

describe("SessionDetail", () => {
  beforeEach(() => {
    apiMock.mockReset();
    show.mockReset();
    replace.mockReset();
  });

  it("describes deletion as archiving and confirms the archive action", async () => {
    apiMock.mockResolvedValue({ id: 7, title: "Sesi lama", status: "completed" });

    render(<SessionDetail />);

    fireEvent.click(await screen.findByRole("button", { name: "Arsipkan" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Arsipkan sesi?");
    expect(screen.getByRole("dialog")).not.toHaveTextContent("dihapus permanen");

    fireEvent.click(screen.getByRole("button", { name: "Arsipkan sesi" }));
    await waitFor(() =>
      expect(apiMock).toHaveBeenCalledWith("/teaching/sessions/7", { method: "DELETE" }),
    );
    expect(show).toHaveBeenCalledWith("Sesi berhasil diarsipkan.");
    expect(replace).toHaveBeenCalledWith("/workspaces/bisa-ai/teaching-sessions");
  });

  it("replaces a failed load with a retry action", async () => {
    apiMock.mockRejectedValueOnce(new Error("Sesi tidak tersedia"));

    render(<SessionDetail />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Sesi tidak tersedia");

    apiMock.mockResolvedValue({
      id: 7,
      title: "Sesi pulih",
      session_date: "2026-09-10",
      status: "draft",
    });
    fireEvent.click(screen.getByRole("button", { name: "Coba lagi" }));

    await waitFor(() => expect(apiMock).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole("heading", { name: "Sesi pulih", level: 1 })).toBeInTheDocument();
  });

  it("shows session_date when scheduled_at is absent", async () => {
    apiMock.mockResolvedValue({
      id: 7,
      title: "Sesi kontrak",
      session_date: "2026-09-10",
      status: "draft",
    });

    render(<SessionDetail />);

    expect(await screen.findByText(/10 September 2026/)).toBeInTheDocument();
  });

  it("renders the session status in Indonesian", async () => {
    apiMock.mockResolvedValue({
      id: 7,
      title: "Sesi berjalan",
      status: "in_progress",
    });

    render(<SessionDetail />);

    expect(await screen.findByText("Berlangsung")).toBeInTheDocument();
    expect(screen.queryByText("in_progress")).not.toBeInTheDocument();
  });

  it("shows participant information, instructors, location, and every activity", async () => {
    apiMock.mockResolvedValue({
      id: 7,
      title: "Kelas lengkap",
      status: "scheduled",
      session_type: "class",
      location: "Lab 2",
      participant_count: 24,
      participant_label: "Mahasiswa",
      audience: "Semester 3",
      instructors: ["Ayu", "Bima"],
      activities: [
        { type: "workshop", startDate: "2026-10-10", endDate: "2026-10-11", mode: "offline" },
        { type: "mentoring", startDate: "2026-10-12", endDate: "2026-10-12", mode: "online" },
      ],
    });

    render(<SessionDetail />);

    expect(await screen.findByText("Lab 2")).toBeInTheDocument();
    const pageHeader = screen.getByRole("heading", { name: "Kelas lengkap", level: 1 }).closest("header")!;
    expect(pageHeader).toHaveTextContent("workshop");
    expect(pageHeader).not.toHaveTextContent("class");
    expect(screen.getByText("24 Mahasiswa")).toBeInTheDocument();
    expect(screen.getByText("Semester 3")).toBeInTheDocument();
    expect(screen.getByText("Ayu, Bima")).toBeInTheDocument();
    expect(screen.getAllByText("workshop")).toHaveLength(2);
    expect(screen.getByText("mentoring")).toBeInTheDocument();
  });
});

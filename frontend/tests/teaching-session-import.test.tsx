import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import TeachingSessionImportPage from "@/app/(protected)/workspaces/[slug]/teaching-sessions/import/page";
import { api } from "@/lib/api";

const push = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => ({ slug: "bisa-ai" }),
  useRouter: () => ({ push, refresh }),
}));
vi.mock("@/lib/api", () => ({ api: vi.fn() }));

const apiMock = vi.mocked(api);

const validImport = {
  sessions: [
    {
      title: "Kelas AI eksternal",
      location: "Lab 2",
      participantCount: 24,
      participantLabel: "Mahasiswa semester 3",
      instructors: ["Ayu", "Bima"],
      activities: [
        {
          type: "workshop",
          startDate: "2026-10-10",
          endDate: "2026-10-11",
          mode: "offline",
        },
      ],
    },
  ],
};

describe("TeachingSessionImportPage", () => {
  beforeEach(() => {
    apiMock.mockReset();
    push.mockReset();
    refresh.mockReset();
    apiMock.mockImplementation(async (path, options) => {
      if (path === "/workspaces/bisa-ai" && !options?.method) {
        return { id: 3, name: "BISA AI", slug: "bisa-ai" };
      }
      if (path === "/workspaces/3/teaching/sessions/import" && options?.method === "POST") {
        return [{ id: 9 }];
      }
      throw new Error("Permintaan tidak diharapkan");
    });
  });

  it("previews JSON before explicitly saving the preserved payload", async () => {
    render(<TeachingSessionImportPage />);

    const input = await screen.findByRole("textbox", { name: "Data JSON" });
    expect((input as HTMLTextAreaElement).value).toContain('"sessions"');
    fireEvent.change(input, { target: { value: JSON.stringify(validImport) } });
    fireEvent.click(screen.getByRole("button", { name: "Validasi & tinjau" }));

    const preview = await screen.findByRole("region", { name: "Pratinjau sesi" });
    expect(apiMock.mock.calls.some(([, options]) => options?.method === "POST")).toBe(false);
    expect(within(preview).getByText("Kelas AI eksternal")).toBeInTheDocument();
    expect(within(preview).getByText("Lab 2")).toBeInTheDocument();
    expect(within(preview).getByText(/24.*Mahasiswa semester 3/)).toBeInTheDocument();
    expect(within(preview).getByText("Ayu, Bima")).toBeInTheDocument();
    expect(within(preview).getByText(/workshop/i)).toBeInTheDocument();
    expect(within(preview).getByText(/10 Oktober 2026.*11 Oktober 2026/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Simpan semua" }));

    await waitFor(() => expect(apiMock).toHaveBeenCalledWith(
      "/workspaces/3/teaching/sessions/import",
      {
        method: "POST",
        body: JSON.stringify({
          sessions: [{ ...validImport.sessions[0], source: "external_ai" }],
        }),
      },
    ));
    expect(push).toHaveBeenCalledWith("/workspaces/bisa-ai/teaching-sessions");
    expect(refresh).toHaveBeenCalledOnce();
  });

  it.each([
    ["JSON rusak", "{", "JSON tidak valid"],
    [
      "field root tidak dikenal",
      JSON.stringify({ ...validImport, unexpectedRoot: true }),
      "Field JSON tidak dikenal: unexpectedRoot",
    ],
    [
      "field sesi tidak dikenal",
      JSON.stringify({ sessions: [{ ...validImport.sessions[0], unexpected: true }] }),
      "Sesi 1: field tidak dikenal: unexpected",
    ],
    [
      "tipe field opsional tidak valid",
      JSON.stringify({ sessions: [{ ...validImport.sessions[0], location: {} }] }),
      "Sesi 1: location harus berupa teks atau null",
    ],
    [
      "field kegiatan tidak dikenal",
      JSON.stringify({
        sessions: [{
          ...validImport.sessions[0],
          activities: [{ ...validImport.sessions[0].activities[0], unexpected: true }],
        }],
      }),
      "Sesi 1, kegiatan 1: field tidak dikenal: unexpected",
    ],
    ["sessions kosong", JSON.stringify({ sessions: [] }), "array sessions yang berisi minimal satu sesi"],
    [
      "judul kosong",
      JSON.stringify({ sessions: [{ ...validImport.sessions[0], title: "  " }] }),
      "Sesi 1: judul wajib diisi",
    ],
    [
      "pengajar kosong",
      JSON.stringify({ sessions: [{ ...validImport.sessions[0], instructors: [] }] }),
      "Sesi 1: pengajar wajib diisi",
    ],
    [
      "kegiatan kosong",
      JSON.stringify({ sessions: [{ ...validImport.sessions[0], activities: [] }] }),
      "Sesi 1: kegiatan wajib diisi",
    ],
    [
      "jenis kegiatan kosong",
      JSON.stringify({
        sessions: [{
          ...validImport.sessions[0],
          activities: [{ ...validImport.sessions[0].activities[0], type: "" }],
        }],
      }),
      "Sesi 1, kegiatan 1: jenis kegiatan wajib diisi",
    ],
    [
      "tanggal mulai kosong",
      JSON.stringify({
        sessions: [{
          ...validImport.sessions[0],
          activities: [{ ...validImport.sessions[0].activities[0], startDate: "" }],
        }],
      }),
      "Sesi 1, kegiatan 1: tanggal mulai wajib diisi",
    ],
    [
      "tanggal selesai kosong",
      JSON.stringify({
        sessions: [{
          ...validImport.sessions[0],
          activities: [{ ...validImport.sessions[0].activities[0], endDate: "" }],
        }],
      }),
      "Sesi 1, kegiatan 1: tanggal selesai wajib diisi",
    ],
    [
      "tanggal terbalik",
      JSON.stringify({
        sessions: [{
          ...validImport.sessions[0],
          activities: [{
            ...validImport.sessions[0].activities[0],
            startDate: "2026-10-12",
            endDate: "2026-10-11",
          }],
        }],
      }),
      "Sesi 1, kegiatan 1: tanggal selesai tidak boleh sebelum tanggal mulai",
    ],
    [
      "tanggal kalender tidak valid",
      JSON.stringify({
        sessions: [{
          ...validImport.sessions[0],
          activities: [{ ...validImport.sessions[0].activities[0], startDate: "2026-02-31" }],
        }],
      }),
      "Sesi 1, kegiatan 1: tanggal mulai tidak valid",
    ],
  ])("rejects %s without saving", async (_caseName, inputValue, expectedError) => {
    render(<TeachingSessionImportPage />);

    const input = screen.getByRole("textbox", { name: "Data JSON" });
    const validateButton = screen.getByRole("button", { name: "Validasi & tinjau" });
    await waitFor(() => expect(validateButton).toBeEnabled());
    fireEvent.change(input, { target: { value: inputValue } });
    fireEvent.click(validateButton);

    expect(await screen.findByRole("alert")).toHaveTextContent(expectedError);
    expect(screen.queryByRole("button", { name: "Simpan semua" })).not.toBeInTheDocument();
    expect(apiMock.mock.calls.some(([, options]) => options?.method === "POST")).toBe(false);
  });
});

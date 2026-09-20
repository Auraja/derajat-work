import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LibraryPage from "@/app/(protected)/library/page";
import { api } from "@/lib/api";

vi.mock("@/lib/api", () => ({ api: vi.fn() }));
const apiMock = vi.mocked(api);

const workspace = {
  id: 7,
  name: "Ruang Ajar",
  slug: "ruang-ajar",
  role: "owner" as const,
  modules: [],
};

function material(id: number, title: string) {
  return {
    id,
    workspace_id: workspace.id,
    title,
    description: "",
    material_type: "document",
    tags: [],
  };
}

describe("LibraryPage", () => {
  beforeEach(() => apiMock.mockReset());

  it("loads every material page from each accessible workspace", async () => {
    apiMock.mockImplementation(async (path = "") => {
      if (path === "/workspaces") return [workspace];
      if (path.includes("page=2")) {
        return { items: [material(2, "Materi halaman kedua")], total: 2, page: 2, page_size: 1, pages: 2 };
      }
      return { items: [material(1, "Materi halaman pertama")], total: 2, page: 1, page_size: 1, pages: 2 };
    });

    render(<LibraryPage />);

    expect(await screen.findByText("Materi halaman pertama")).toBeInTheDocument();
    expect(await screen.findByText("Materi halaman kedua")).toBeInTheDocument();
    expect(apiMock).toHaveBeenCalledWith("/materials?workspace_id=7&page=1&page_size=100");
    expect(apiMock).toHaveBeenCalledWith("/materials?workspace_id=7&page=2&page_size=100");
  });

  it("links material details through their workspace context", async () => {
    apiMock.mockImplementation(async (path = "") => {
      if (path === "/workspaces") return [workspace];
      return {
        items: [material(1, "Materi tertaut")],
        total: 1,
        page: 1,
        page_size: 100,
        pages: 1,
      };
    });

    render(<LibraryPage />);

    expect(screen.getByRole("heading", { name: "Pustaka global", level: 1 })).toBeInTheDocument();
    expect(screen.getByLabelText("Cari pustaka")).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Materi tertaut" })).toHaveAttribute(
      "href",
      "/workspaces/ruang-ajar/materials/1",
    );
  });

  it("shows a retry action when the library cannot load", async () => {
    apiMock.mockRejectedValueOnce(new Error("Pustaka tidak tersedia"));
    render(<LibraryPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Pustaka tidak tersedia");

    apiMock.mockResolvedValue([]);
    fireEvent.click(screen.getByRole("button", { name: "Coba lagi" }));

    expect(await screen.findByText("Pustaka masih kosong")).toBeInTheDocument();
  });

  it("does not silently hide a workspace material failure", async () => {
    apiMock
      .mockResolvedValueOnce([workspace])
      .mockRejectedValueOnce(new Error("Materi ruang gagal dimuat"));

    render(<LibraryPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Materi ruang gagal dimuat");
    expect(screen.getByRole("button", { name: "Coba lagi" })).toBeInTheDocument();
  });
});

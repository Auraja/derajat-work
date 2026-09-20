import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ResourceList } from "@/components/resource-list";
import { api } from "@/lib/api";
import type { Workspace } from "@/lib/types";

vi.mock("@/lib/api", () => ({ api: vi.fn() }));
const apiMock = vi.mocked(api);

const workspace: Workspace = {
  id: 1,
  name: "Ruang Pribadi",
  slug: "pribadi",
  description: "",
  role: "owner",
  modules: [],
};

describe("ResourceList", () => {
  beforeEach(() => {
    apiMock.mockReset();
  });

  it("loads and navigates every API page", async () => {
    apiMock.mockImplementation(async (path) => {
      const page = path.includes("page=2") ? 2 : 1;
      return {
        items: [
          {
            id: page,
            title: page === 1 ? "Materi pertama" : "Materi kedua",
            description: "",
            material_type: "document",
            tags: [],
          },
        ],
        total: 2,
        page,
        page_size: 1,
        pages: 2,
      };
    });

    render(<ResourceList kind="materials" workspace={workspace} />);

    expect(screen.getByRole("heading", { name: "Materi", level: 1 })).toBeInTheDocument();
    expect(screen.getByLabelText("Cari materi")).toBeInTheDocument();
    expect(await screen.findByText("Materi pertama")).toBeInTheDocument();
    expect(apiMock).toHaveBeenCalledWith("/materials?workspace_id=1&page=1&page_size=20");

    fireEvent.click(screen.getByRole("button", { name: "Berikutnya" }));

    await waitFor(() => expect(screen.getByText("Materi kedua")).toBeInTheDocument());
    expect(apiMock).toHaveBeenLastCalledWith("/materials?workspace_id=1&page=2&page_size=20");
  });

  it("searches the complete server-side collection and resets pagination", async () => {
    apiMock.mockImplementation(async (path) => {
      const page = path.includes("page=2") ? 2 : 1;
      return {
        items: [
          {
            id: page,
            title: page === 1 ? "Materi pertama" : "Materi kedua",
            description: "",
            material_type: "document",
            tags: [],
          },
        ],
        total: 40,
        page,
        page_size: 20,
        pages: 2,
      };
    });

    render(<ResourceList kind="materials" workspace={workspace} />);
    expect(await screen.findByText("Materi pertama")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Berikutnya" }));
    expect(await screen.findByText("Materi kedua")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Cari materi"), {
      target: { value: "halaman kedua" },
    });

    await waitFor(() =>
      expect(apiMock).toHaveBeenLastCalledWith(
        "/materials?workspace_id=1&page=1&page_size=20&search=halaman%20kedua",
      ),
    );
  });

  it("shows a retry action when a resource list cannot load", async () => {
    apiMock.mockRejectedValueOnce(new Error("Materi tidak tersedia"));
    render(<ResourceList kind="materials" workspace={workspace} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Materi tidak tersedia");

    apiMock.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 20, pages: 0 });
    fireEvent.click(screen.getByRole("button", { name: "Coba lagi" }));

    expect(await screen.findByText("Belum ada materi")).toBeInTheDocument();
  });
});

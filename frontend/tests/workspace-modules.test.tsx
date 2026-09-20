import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import WorkspaceOverview from "@/app/(protected)/workspaces/[slug]/page";
import { api } from "@/lib/api";

vi.mock("next/navigation", () => ({ useParams: () => ({ slug: "bisa-ai" }) }));
vi.mock("@/lib/api", () => ({ api: vi.fn(), jsonBody: (value: unknown) => ({ body: JSON.stringify(value) }) }));
const apiMock = vi.mocked(api);

describe("Pengaturan modul workspace", () => {
  beforeEach(() => apiMock.mockReset());
  it("lets an owner add a sidebar module", async () => {
    apiMock.mockImplementation(async (path) => {
      if (path === "/workspaces/bisa-ai") return { id: 1, name: "BISA AI", slug: "bisa-ai", role: "owner", modules: [] };
      if (path === "/workspaces/1/skills" || path === "/workspaces/1/orchestrations") return [];
      if (path === "/workspaces/1/modules") return { id: 8, name: "Klien", slug: "clients" };
      return [];
    });
    render(<WorkspaceOverview />);
    expect(await screen.findByRole("heading", { name: "Atur menu workspace" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Nama menu baru"), { target: { value: "Klien" } });
    fireEvent.click(screen.getByRole("button", { name: "Tambah menu" }));
    await waitFor(() => expect(screen.getAllByText("Klien").length).toBeGreaterThan(0));
  });
});

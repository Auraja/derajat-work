import { render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppShell } from "@/components/app-shell";
import WorkspaceOverview from "@/app/(protected)/workspaces/[slug]/page";
import TeachingOverview from "@/app/(protected)/workspaces/[slug]/teaching/page";
import { api } from "@/lib/api";

vi.mock("next/navigation", () => ({
  useParams: () => ({ slug: "bisa-ai" }),
  usePathname: () => "/workspaces/bisa-ai/teaching-sessions/7/edit",
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/lib/api", () => ({
  api: vi.fn(),
  jsonBody: (value: unknown) => ({ body: JSON.stringify(value) }),
}));

const apiMock = vi.mocked(api);
const workspace = {
  id: 3,
  name: "BISA AI",
  slug: "bisa-ai",
  modules: [{ id: 4, name: "Teaching", slug: "teaching" }],
};

describe("navigasi Sesi Mengajar", () => {
  beforeEach(() => {
    apiMock.mockImplementation(async (path) => {
      if (path === "/workspaces" ) return [workspace];
      if (path === "/workspaces/bisa-ai") return workspace;
      if (String(path).includes("/skills") || String(path).includes("/orchestrations")) return [];
      return { id: 1, email: "dedi@example.test" };
    });
  });

  it("shows Sesi Mengajar directly after Mengajar and keeps it active on child routes", async () => {
    render(<AppShell><p>Isi</p></AppShell>);

    const navigation = await screen.findByLabelText("Navigasi utama");
    await waitFor(() => expect(within(navigation).getByRole("link", { name: "Mengajar" })).toBeInTheDocument());
    const links = within(navigation).getAllByRole("link");
    const labels = links.map((link) => link.textContent?.trim());
    expect(labels.indexOf("Sesi Mengajar")).toBe(labels.indexOf("Mengajar") + 1);
    expect(within(navigation).getByRole("link", { name: "Sesi Mengajar" })).toHaveAttribute(
      "href",
      "/workspaces/bisa-ai/teaching-sessions",
    );
    expect(within(navigation).getByRole("link", { name: "Sesi Mengajar" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("exposes Sesi Mengajar as its own workspace card", async () => {
    render(<WorkspaceOverview />);

    const cardTitle = await screen.findByRole("heading", { name: "Sesi Mengajar" });
    expect(cardTitle.closest("a")).toHaveAttribute("href", "/workspaces/bisa-ai/teaching-sessions");
    expect(screen.getByText("1 aktif")).toBeInTheDocument();
  });

  it("does not duplicate the synthetic module if the backend returns the same slug", async () => {
    apiMock.mockImplementation(async (path) => {
      const workspaceWithDuplicate = {
        ...workspace,
        modules: [
          ...workspace.modules,
          { id: 5, name: "Sesi Mengajar", slug: "teaching-sessions" },
        ],
      };
      if (path === "/workspaces") return [workspaceWithDuplicate];
      if (path === "/workspaces/bisa-ai") return workspaceWithDuplicate;
      if (String(path).includes("/skills") || String(path).includes("/orchestrations")) return [];
      return { id: 1, email: "dedi@example.test" };
    });

    render(<AppShell><p>Isi</p></AppShell>);

    const navigation = await screen.findByLabelText("Navigasi utama");
    await waitFor(() => expect(within(navigation).getAllByRole("link", { name: "Sesi Mengajar" })).toHaveLength(1));
  });

  it("points teaching overview session actions at the separate module", () => {
    render(<TeachingOverview />);

    expect(screen.getByRole("link", { name: "Tambah sesi" })).toHaveAttribute(
      "href",
      "/workspaces/bisa-ai/teaching-sessions/new",
    );
    expect(screen.getByRole("link", { name: "Lihat semua sesi" })).toHaveAttribute(
      "href",
      "/workspaces/bisa-ai/teaching-sessions",
    );
  });
});
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import DashboardPage from "@/app/(protected)/dashboard/page";
import { api } from "@/lib/api";

vi.mock("@/lib/api", () => ({ api: vi.fn() }));

const apiMock = vi.mocked(api);

const workspace = {
  id: 1,
  name: "PT BISA AI",
  slug: "bisa-ai",
  role: "owner" as const,
  modules: [],
};

describe("DashboardPage", () => {
  beforeEach(() => apiMock.mockReset());

  it("replaces a failed primary load with a retry action", async () => {
    apiMock.mockImplementation(async (path) => {
      if (path === "/auth/me") throw new Error("Dasbor tidak tersedia");
      if (path === "/workspaces") return [];
      return { items: [], total: 0, page: 1, page_size: 5, pages: 0 };
    });

    render(<DashboardPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Dasbor tidak tersedia");
    apiMock.mockImplementation(async (path) => {
      if (path === "/auth/me") return { id: 1, name: "Dedi", email: "dedi@example.test" };
      if (path === "/workspaces") return [workspace];
      return { items: [], total: 0, page: 1, page_size: 5, pages: 0 };
    });
    fireEvent.click(screen.getByRole("button", { name: "Coba lagi" }));

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Selamat datang, Dedi." })).toBeInTheDocument(),
    );
    expect(screen.getAllByText("PT BISA AI").length).toBeGreaterThan(0);
  });

  it("uses paginated totals for session and material metrics", async () => {
    apiMock.mockImplementation(async (path) => {
      if (path === "/auth/me") {
        return { id: 1, name: "Dedi", email: "dedi@example.test" };
      }
      if (path === "/workspaces") return [workspace];
      if (typeof path !== "string") return [];
      if (path.includes("/teaching/sessions")) {
        return { items: [], total: 12, page: 1, page_size: 5, pages: 3 };
      }
      if (path.includes("/materials")) {
        return { items: [], total: 9, page: 1, page_size: 5, pages: 2 };
      }
      throw new Error(`Unexpected API path: ${path}`);
    });

    render(<DashboardPage />);

    expect(await screen.findByText("12")).toBeInTheDocument();
    expect(screen.getByText("9")).toBeInTheDocument();
  });
});

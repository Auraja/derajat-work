import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import WorkspaceOverview from "@/app/(protected)/workspaces/[slug]/page";
import { api } from "@/lib/api";

vi.mock("next/navigation", () => ({ useParams: () => ({ slug: "bisa-ai" }) }));
vi.mock("@/lib/api", () => ({ api: vi.fn() }));

const apiMock = vi.mocked(api);

describe("WorkspaceOverview", () => {
  beforeEach(() => apiMock.mockReset());

  it("replaces the loading skeleton with a retryable error", async () => {
    apiMock.mockRejectedValueOnce(new Error("Ruang tidak tersedia"));
    render(<WorkspaceOverview />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Ruang tidak tersedia");
    apiMock.mockImplementation(async (path) => {
      if (path === "/workspaces/bisa-ai") {
        return {
          id: 1,
          name: "PT BISA AI",
          slug: "bisa-ai",
          role: "owner",
          modules: [],
        };
      }
      return [];
    });
    fireEvent.click(screen.getByRole("button", { name: "Coba lagi" }));

    await waitFor(() =>
      expect(screen.getByRole("heading", { level: 1, name: "PT BISA AI" })).toBeInTheDocument(),
    );
  });
});
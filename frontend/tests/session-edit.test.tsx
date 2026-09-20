import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import EditSessionPage from "@/app/(protected)/workspaces/[slug]/teaching/sessions/[id]/edit/page";
import { api } from "@/lib/api";

vi.mock("next/navigation", () => ({
  useParams: () => ({ slug: "bisa-ai", id: "7" }),
  useRouter: () => ({ back: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/lib/api", () => ({ api: vi.fn() }));
vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ show: vi.fn() }),
}));

const apiMock = vi.mocked(api);

describe("EditSessionPage", () => {
  beforeEach(() => {
    apiMock.mockReset();
  });

  it("replaces a failed session load with a retry action", async () => {
    apiMock.mockRejectedValueOnce(new Error("Sesi tidak tersedia"));

    render(<EditSessionPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Sesi tidak tersedia");

    apiMock.mockImplementation(async (path) => {
      if (path === "/teaching/sessions/7") {
        return { id: 7, title: "Sesi pulih", status: "draft" };
      }
      return { id: 3, name: "BISA AI", slug: "bisa-ai" };
    });
    fireEvent.click(screen.getByRole("button", { name: "Coba lagi" }));

    await waitFor(() => expect(apiMock).toHaveBeenCalledWith("/teaching/sessions/7"));
    expect(await screen.findByDisplayValue("Sesi pulih")).toBeInTheDocument();
  });
});

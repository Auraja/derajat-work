import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ResourceDetail } from "@/components/resource-detail";
import { api } from "@/lib/api";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/lib/api", () => ({ api: vi.fn() }));
vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ show: vi.fn() }),
}));

const apiMock = vi.mocked(api);

describe("ResourceDetail", () => {
  beforeEach(() => {
    apiMock.mockReset();
  });

  it("replaces a failed load with a retry action", async () => {
    apiMock.mockRejectedValueOnce(new Error("Materi tidak tersedia"));

    render(<ResourceDetail kind="materials" id="7" />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Materi tidak tersedia");

    apiMock.mockResolvedValue({ id: 7, title: "Materi pulih" });
    fireEvent.click(screen.getByRole("button", { name: "Coba lagi" }));

    await waitFor(() => expect(apiMock).toHaveBeenCalledTimes(2));
    expect(
      await screen.findByRole("heading", { name: "Materi pulih", level: 1 }),
    ).toBeInTheDocument();
  });
});

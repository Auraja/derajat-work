import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SessionsPage from "@/app/(protected)/workspaces/[slug]/teaching/sessions/page";
import { api } from "@/lib/api";

vi.mock("next/navigation", () => ({
  useParams: () => ({ slug: "bisa-ai" }),
}));
vi.mock("@/lib/api", () => ({ api: vi.fn() }));

const apiMock = vi.mocked(api);

describe("SessionsPage", () => {
  beforeEach(() => {
    apiMock.mockReset();
  });

  it("replaces a failed workspace load with a retry action", async () => {
    apiMock.mockRejectedValueOnce(new Error("Ruang tidak tersedia"));

    render(<SessionsPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Ruang tidak tersedia");

    apiMock.mockImplementation(async (path) => {
      if (path === "/workspaces/bisa-ai") {
        return { id: 3, name: "BISA AI", slug: "bisa-ai" };
      }
      return { items: [], total: 0, page: 1, page_size: 10, pages: 0 };
    });
    fireEvent.click(screen.getByRole("button", { name: "Coba lagi" }));

    await waitFor(() => expect(apiMock).toHaveBeenCalledWith("/workspaces/bisa-ai"));
    expect(await screen.findByText("Belum ada sesi")).toBeInTheDocument();
  });

  it("offers every teaching-session status accepted by the backend", async () => {
    apiMock.mockImplementation(async (path) => {
      if (path === "/workspaces/bisa-ai") {
        return { id: 3, name: "BISA AI", slug: "bisa-ai" };
      }
      return { items: [], total: 0, page: 1, page_size: 10, pages: 0 };
    });

    render(<SessionsPage />);

    const status = await screen.findByLabelText("Filter status");
    expect(status.querySelector('option[value="scheduled"]')).not.toBeNull();
    expect(status.querySelector('option[value="in_progress"]')).not.toBeNull();
    expect(status.querySelector('option[value="cancelled"]')).not.toBeNull();
    expect(status.querySelector('option[value="archived"]')).toBeNull();
  });

  it("labels the session page in Indonesian", async () => {
    apiMock.mockImplementation(async (path) => {
      if (path === "/workspaces/bisa-ai") {
        return { id: 3, name: "BISA AI", slug: "bisa-ai" };
      }
      return { items: [], total: 0, page: 1, page_size: 10, pages: 0 };
    });

    render(<SessionsPage />);

    expect(screen.getByRole("heading", { name: "Sesi pengajaran", level: 1 })).toBeInTheDocument();
    expect(await screen.findByText("Belum ada sesi")).toBeInTheDocument();
  });

  it("shows session_date in the list when scheduled_at is absent", async () => {
    apiMock.mockImplementation(async (path) => {
      if (path === "/workspaces/bisa-ai") {
        return { id: 3, name: "BISA AI", slug: "bisa-ai" };
      }
      return {
        items: [
          {
            id: 7,
            title: "Sesi kontrak",
            session_date: "2026-09-10",
            status: "draft",
          },
        ],
        total: 1,
        page: 1,
        page_size: 10,
        pages: 1,
      };
    });

    render(<SessionsPage />);

    expect(await screen.findByText("10 Sep 2026")).toBeInTheDocument();
  });

  it("renders session statuses in Indonesian", async () => {
    apiMock.mockImplementation(async (path) => {
      if (path === "/workspaces/bisa-ai") {
        return { id: 3, name: "BISA AI", slug: "bisa-ai" };
      }
      return {
        items: [{ id: 7, title: "Sesi batal", status: "cancelled" }],
        total: 1,
        page: 1,
        page_size: 10,
        pages: 1,
      };
    });

    render(<SessionsPage />);

    const row = (await screen.findByText("Sesi batal")).closest("tr")!;
    expect(within(row).getByText("Dibatalkan")).toBeInTheDocument();
    expect(within(row).queryByText("cancelled")).not.toBeInTheDocument();
  });

  it("ignores stale debounced search responses", async () => {
    let resolveOld: (value: unknown) => void = () => undefined;
    let resolveNew: (value: unknown) => void = () => undefined;
    apiMock.mockImplementation(async (path) => {
      if (path === "/workspaces/bisa-ai") {
        return { id: 3, name: "BISA AI", slug: "bisa-ai" };
      }
      if (path.includes("search=lama")) {
        return new Promise((resolve) => {
          resolveOld = resolve;
        });
      }
      if (path.includes("search=baru")) {
        return new Promise((resolve) => {
          resolveNew = resolve;
        });
      }
      return { items: [], total: 0, page: 1, page_size: 10, pages: 0 };
    });

    render(<SessionsPage />);
    await screen.findByText("Belum ada sesi");

    fireEvent.change(screen.getByLabelText("Cari sesi"), { target: { value: "lama" } });
    await waitFor(() =>
      expect(apiMock).toHaveBeenCalledWith(expect.stringContaining("search=lama")),
    );
    fireEvent.change(screen.getByLabelText("Cari sesi"), { target: { value: "baru" } });
    await waitFor(() =>
      expect(apiMock).toHaveBeenCalledWith(expect.stringContaining("search=baru")),
    );

    resolveNew({
      items: [{ id: 2, title: "Hasil baru", status: "draft" }],
      total: 1,
      page: 1,
      page_size: 10,
      pages: 1,
    });
    expect(await screen.findByText("Hasil baru")).toBeInTheDocument();

    resolveOld({
      items: [{ id: 1, title: "Hasil lama", status: "draft" }],
      total: 1,
      page: 1,
      page_size: 10,
      pages: 1,
    });
    await waitFor(() => expect(screen.queryByText("Hasil lama")).not.toBeInTheDocument());
    expect(screen.getByText("Hasil baru")).toBeInTheDocument();
  });
});

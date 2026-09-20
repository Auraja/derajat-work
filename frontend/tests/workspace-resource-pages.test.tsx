import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  WorkspaceResourceEditor,
  WorkspaceResourceList,
} from "@/components/workspace-resource-pages";
import { api } from "@/lib/api";

vi.mock("next/navigation", () => ({
  useParams: () => ({ slug: "bisa-ai", id: "7" }),
}));
vi.mock("@/lib/api", () => ({ api: vi.fn() }));
vi.mock("@/components/material-form", () => ({
  MaterialForm: () => <div>material-form</div>,
}));
vi.mock("@/components/template-form", () => ({
  TemplateForm: () => <div>template-form</div>,
}));
vi.mock("@/components/resource-list", () => ({
  ResourceList: () => <div>resource-list</div>,
}));
vi.mock("@/components/resource-detail", () => ({
  ResourceDetail: () => <div>resource-detail</div>,
}));

const apiMock = vi.mocked(api);
const workspace = { id: 3, name: "BISA AI", slug: "bisa-ai" };

describe("workspace resource pages", () => {
  beforeEach(() => {
    apiMock.mockReset();
  });

  it("replaces a failed workspace load with a retry action", async () => {
    apiMock.mockRejectedValueOnce(new Error("Ruang tidak tersedia"));
    render(<WorkspaceResourceList kind="materials" />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Ruang tidak tersedia");

    apiMock.mockResolvedValue(workspace);
    fireEvent.click(screen.getByRole("button", { name: "Coba lagi" }));

    expect(await screen.findByText("resource-list")).toBeInTheDocument();
  });

  it("replaces a failed editor-item load with a retry action", async () => {
    apiMock.mockImplementation(async (path) => {
      if (path === "/workspaces/bisa-ai") return workspace;
      throw new Error("Materi tidak tersedia");
    });
    render(<WorkspaceResourceEditor kind="materials" edit />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Materi tidak tersedia");

    apiMock.mockImplementation(async (path) => {
      if (path === "/workspaces/bisa-ai") return workspace;
      return { id: 7, title: "Materi pulih" };
    });
    fireEvent.click(screen.getByRole("button", { name: "Coba lagi" }));

    await waitFor(() => expect(apiMock).toHaveBeenCalledWith("/materials/7"));
    expect(await screen.findByText("material-form")).toBeInTheDocument();
  });
});

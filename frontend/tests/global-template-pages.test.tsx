import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GlobalTemplateEditor } from "@/components/global-template-pages";
import { api } from "@/lib/api";

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "7" }),
}));
vi.mock("@/lib/api", () => ({ api: vi.fn() }));
vi.mock("@/components/template-form", () => ({
  TemplateForm: () => <div>template-form</div>,
}));
vi.mock("@/components/resource-detail", () => ({
  ResourceDetail: () => <div>resource-detail</div>,
}));

const apiMock = vi.mocked(api);

describe("GlobalTemplateEditor", () => {
  beforeEach(() => {
    apiMock.mockReset();
  });

  it("replaces a failed template load with a retry action", async () => {
    apiMock.mockRejectedValueOnce(new Error("Template tidak tersedia"));
    render(<GlobalTemplateEditor edit />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Template tidak tersedia");

    apiMock.mockResolvedValue({ id: 7, name: "Template pulih" });
    fireEvent.click(screen.getByRole("button", { name: "Coba lagi" }));

    expect(await screen.findByText("template-form")).toBeInTheDocument();
  });
});

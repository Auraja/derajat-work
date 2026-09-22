import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import TeachingLayout from "@/app/(protected)/workspaces/[slug]/teaching/layout";

vi.mock("next/navigation", () => ({
  useParams: () => ({ slug: "bisa-ai" }),
  usePathname: () => "/workspaces/bisa-ai/teaching",
}));

describe("TeachingLayout", () => {
  it("labels teaching navigation in Indonesian", () => {
    render(<TeachingLayout><p>Isi</p></TeachingLayout>);

    const navigation = screen.getByRole("navigation", { name: "Navigasi pengajaran" });
    for (const label of [
      "Ringkasan",
      "Materi",
      "Template",
      "Slide",
      "Modul",
      "Kuis",
      "Tugas",
      "Rencana pembelajaran",
    ]) {
      expect(navigation).toHaveTextContent(label);
    }
    expect(navigation).not.toHaveTextContent("Sesi");
  });
});

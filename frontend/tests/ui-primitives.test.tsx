import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LoadingBlock, ResponsiveTable } from "@/components/ui";

describe("LoadingBlock", () => {
  it("announces a named polite status while hiding decorative skeletons", () => {
    render(<LoadingBlock />);

    const status = screen.getByRole("status", { name: "Memuat konten" });

    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status.querySelectorAll('[aria-hidden="true"]')).toHaveLength(3);
  });
});

describe("ResponsiveTable", () => {
  it("marks generated headers as column headers", () => {
    render(
      <ResponsiveTable headers={["Materi", "Status"]}>
        <tr>
          <td data-label="Materi">Aljabar</td>
          <td data-label="Status">Aktif</td>
        </tr>
      </ResponsiveTable>,
    );

    expect(screen.getAllByRole("columnheader")).toEqual([
      expect.objectContaining({ scope: "col" }),
      expect.objectContaining({ scope: "col" }),
    ]);
  });
});

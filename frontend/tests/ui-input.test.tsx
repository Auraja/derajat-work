import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Input, Textarea } from "@/components/ui";

describe("Input", () => {
  it("merges custom classes with the base control class", () => {
    render(<Input aria-label="Pencarian" className="pl-9" />);

    expect(screen.getByLabelText("Pencarian")).toHaveClass("control", "pl-9");
  });

  it("associates help and error text without replacing caller descriptions", () => {
    const { rerender } = render(
      <>
        <p id="account-hint">Gunakan akun utama.</p>
        <Input
          label="Email"
          help="Kami tidak akan membagikan email Anda."
          error="Email wajib diisi."
          aria-describedby="account-hint"
        />
      </>,
    );

    const input = screen.getByLabelText("Email");
    const describedBy = input.getAttribute("aria-describedby")?.split(" ") ?? [];

    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(describedBy).toContain("account-hint");
    expect(describedBy).toHaveLength(3);
    expect(describedBy.map((id) => document.getElementById(id)?.textContent)).toEqual([
      "Gunakan akun utama.",
      "Email wajib diisi.",
      "Kami tidak akan membagikan email Anda.",
    ]);

    rerender(
      <>
        <p id="account-hint">Gunakan akun utama.</p>
        <Input
          label="Email"
          help="Kami tidak akan membagikan email Anda."
          error="Email wajib diisi."
          aria-describedby="account-hint"
        />
      </>,
    );

    expect(screen.getByLabelText("Email")).toHaveAttribute(
      "aria-describedby",
      describedBy.join(" "),
    );
  });
});

describe("Textarea", () => {
  it("associates help and error text without replacing caller descriptions", () => {
    render(
      <>
        <p id="description-hint">Ringkas dan spesifik.</p>
        <Textarea
          label="Deskripsi"
          help="Maksimal 500 karakter."
          error="Deskripsi wajib diisi."
          aria-describedby="description-hint"
        />
      </>,
    );

    const textarea = screen.getByLabelText("Deskripsi");
    const describedBy = textarea.getAttribute("aria-describedby")?.split(" ") ?? [];

    expect(textarea).toHaveAttribute("aria-invalid", "true");
    expect(describedBy).toHaveLength(3);
    expect(describedBy.map((id) => document.getElementById(id)?.textContent)).toEqual([
      "Ringkas dan spesifik.",
      "Deskripsi wajib diisi.",
      "Maksimal 500 karakter.",
    ]);
  });
});

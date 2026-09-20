import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { ModalFrame } from "@/components/ui/modal-frame";

function Harness() {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  return (
    <>
      <button onClick={() => setOpen(true)}>Buka editor</button>
      {open && (
        <ModalFrame titleId="editor-title" onClose={() => setOpen(false)}>
          <h2 id="editor-title">Editor</h2>
          <button>Pertama</button>
          <label>
            Judul
            <input value={value} onChange={(event) => setValue(event.target.value)} />
          </label>
          <button>Terakhir</button>
        </ModalFrame>
      )}
    </>
  );
}

describe("ModalFrame", () => {
  it("traps focus, closes with Escape, and restores trigger focus", () => {
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Buka editor" });
    trigger.focus();
    fireEvent.click(trigger);

    const first = screen.getByRole("button", { name: "Pertama" });
    const last = screen.getByRole("button", { name: "Terakhir" });
    expect(first).toHaveFocus();
    expect(trigger).toHaveAttribute("inert");
    expect(trigger).toHaveAttribute("aria-hidden", "true");

    last.focus();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Tab" });
    expect(first).toHaveFocus();

    first.focus();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Tab", shiftKey: true });
    expect(last).toHaveFocus();

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(trigger).not.toHaveAttribute("inert");
    expect(trigger).not.toHaveAttribute("aria-hidden");
  });

  it("keeps focus in a controlled input while its parent rerenders", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Buka editor" }));
    const input = screen.getByLabelText("Judul");
    input.focus();

    fireEvent.change(input, { target: { value: "Tugas baru" } });

    expect(input).toHaveValue("Tugas baru");
    expect(input).toHaveFocus();
  });
});

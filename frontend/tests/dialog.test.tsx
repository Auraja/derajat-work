import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { Dialog } from "@/components/ui/dialog";

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Buka dialog</button>
      <Dialog
        open={open}
        title="Hapus item?"
        description="Tindakan ini permanen."
        onClose={() => setOpen(false)}
        onConfirm={() => undefined}
      />
    </>
  );
}

describe("Dialog", () => {
  it("contains keyboard focus, closes with Escape, and restores focus", () => {
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Buka dialog" });
    trigger.focus();
    fireEvent.click(trigger);

    const first = screen.getByRole("button", { name: "Batal" });
    const last = screen.getByRole("button", { name: "Hapus" });
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
});

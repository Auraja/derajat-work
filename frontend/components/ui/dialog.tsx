"use client";

import { useEffect, useRef } from "react";
import { Button } from "./index";
import { makeBackgroundInert } from "./modal-accessibility";

const FOCUSABLE = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export function Dialog({
  open,
  title,
  description,
  confirmLabel = "Hapus",
  busy,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  busy?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const dialog = dialogRef.current;
    const restoreBackground = dialog?.parentElement
      ? makeBackgroundInert(dialog.parentElement)
      : () => undefined;
    const focusable = () =>
      Array.from(dialog?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);

    focusable()[0]?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const elements = focusable();
      if (elements.length === 0) {
        event.preventDefault();
        dialog?.focus();
        return;
      }
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      restoreBackground();
      previousFocus?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        aria-describedby="dialog-description"
        tabIndex={-1}
        className="modal-card max-w-md"
      >
        <p className="eyebrow">Konfirmasi</p>
        <h2 id="dialog-title" className="editorial-title mt-2 text-3xl">
          {title}
        </h2>
        <p id="dialog-description" className="mt-4 text-sm leading-6 text-muted">
          {description}
        </p>
        <div className="mt-7 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button variant="danger" disabled={busy} onClick={onConfirm}>
            {busy ? "Memproses…" : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

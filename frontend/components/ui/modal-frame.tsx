"use client";

import { useEffect, useRef } from "react";
import { makeBackgroundInert } from "./modal-accessibility";

const FOCUSABLE = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export function ModalFrame({
  titleId,
  onClose,
  className = "",
  initialFocusSelector,
  children,
}: {
  titleId: string;
  onClose: () => void;
  className?: string;
  initialFocusSelector?: string;
  children: React.ReactNode;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    const dialog = dialogRef.current;
    const restoreBackground = dialog?.parentElement
      ? makeBackgroundInert(dialog.parentElement)
      : () => undefined;
    const focusable = () =>
      Array.from(dialog?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);

    document.body.style.overflow = "hidden";
    const initial =
      (initialFocusSelector
        ? dialog?.querySelector<HTMLElement>(initialFocusSelector)
        : null) ?? focusable()[0];
    initial?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
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
      document.body.style.overflow = previousOverflow;
      restoreBackground();
      previousFocus?.focus();
    };
  }, [initialFocusSelector]);

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
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`modal-card ${className}`}
      >
        {children}
      </div>
    </div>
  );
}

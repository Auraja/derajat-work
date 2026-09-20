"use client";
import { createContext, useCallback, useContext, useMemo, useState } from "react";

type Tone = "success" | "error" | "info";
type Toast = { id: number; message: string; tone: Tone };
const ToastContext = createContext<{ show: (message: string, tone?: Tone) => void }>({ show: () => undefined });

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const show = useCallback((message: string, tone: Tone = "success") => {
    const id = Date.now() + Math.random(); setToasts((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 4200);
  }, []);
  const value = useMemo(() => ({ show }), [show]);
  return <ToastContext.Provider value={value}>{children}<div aria-live="polite" className="fixed bottom-4 right-4 z-[80] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2">{toasts.map((toast) => <div key={toast.id} role="status" className={`rounded-lg border px-4 py-3 text-sm shadow-lg ${toast.tone === "error" ? "border-[#d5aaa5] bg-[#fff5f3] text-[#7c2d26]" : toast.tone === "info" ? "border-[#b9c3d8] bg-[#f5f7fb] text-primary" : "border-[#b8c9ae] bg-[#f4f9f1] text-[#40583b]"}`}>{toast.message}</div>)}</div></ToastContext.Provider>;
}
export const useToast = () => useContext(ToastContext);

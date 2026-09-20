import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast";

export const metadata: Metadata = {
  title: { default: "Derajat", template: "%s · Derajat" },
  description: "Ruang kerja pribadi untuk pekerjaan, pengetahuan, skills, dan orkestrasi.",
};

const themeScript = `try{document.documentElement.dataset.theme=localStorage.getItem("derajat.theme")==="dark"?"dark":"light"}catch(e){document.documentElement.dataset.theme="light"}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head><body><ToastProvider>{children}</ToastProvider></body></html>;
}

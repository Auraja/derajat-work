"use client";
import { Button } from "@/components/ui";
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) { return <div className="surface p-8 text-center"><h2 className="font-serif text-2xl text-primary">Ada kendala memuat halaman</h2><p className="mx-auto mt-3 max-w-xl text-sm text-muted">{error.message || "Coba muat kembali halaman ini."}</p><Button className="mt-6" onClick={reset}>Coba lagi</Button></div>; }

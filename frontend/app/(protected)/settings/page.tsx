"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, PageHeader } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { applyTheme, readTheme, type ThemeMode } from "@/lib/theme";
import type { User } from "@/lib/types";

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState({ name: "", email: "" });
  const [password, setPassword] = useState({ current_password: "", new_password: "", confirm: "" });
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [error, setError] = useState("");
  const { show } = useToast();
  const router = useRouter();

  useEffect(() => {
    api<User>("/auth/me").then((value) => {
      setUser(value);
      setProfile({ name: value.name, email: value.email });
    });
    const frame = requestAnimationFrame(() => {
      const savedTheme = readTheme();
      setTheme(savedTheme);
      applyTheme(savedTheme, false);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  function chooseTheme(value: ThemeMode) {
    setTheme(value);
    applyTheme(value);
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const value = await api<User>("/users/me", { method: "PATCH", body: JSON.stringify(profile) });
      setUser(value);
      show("Profil berhasil diperbarui.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Profil gagal disimpan.");
    }
  }

  async function savePassword(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (password.new_password !== password.confirm) {
      setError("Konfirmasi password tidak sama.");
      return;
    }
    try {
      await api("/users/me/password", { method: "PATCH", body: JSON.stringify({ current_password: password.current_password, new_password: password.new_password }) });
      show("Password diperbarui. Silakan masuk kembali.");
      router.replace("/login");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Password gagal diperbarui.");
    }
  }

  return <>
    <PageHeader title="Settings" description="Kelola tampilan, identitas akun, dan keamanan akses Anda." />
    {error && <p role="alert" className="error-box mb-5">{error}</p>}
    <div className="grid gap-6 xl:grid-cols-2">
      <section className="surface appearance-settings p-5 sm:p-7 xl:col-span-2" aria-labelledby="appearance-title">
        <div><h2 id="appearance-title" className="font-serif text-xl text-primary">Tampilan</h2><p className="mt-2 text-sm text-muted">Pilih tema yang nyaman untuk ruang kerja Anda.</p></div>
        <div className="theme-options" aria-label="Pilihan tema">
          <button type="button" aria-label="Mode terang" aria-pressed={theme === "light"} className={theme === "light" ? "active" : ""} onClick={() => chooseTheme("light")}><span aria-hidden>☀</span><strong>Terang</strong><small>Latar hangat dan bersih</small></button>
          <button type="button" aria-label="Mode gelap" aria-pressed={theme === "dark"} className={theme === "dark" ? "active" : ""} onClick={() => chooseTheme("dark")}><span aria-hidden>◐</span><strong>Gelap</strong><small>Lebih nyaman pada malam hari</small></button>
        </div>
      </section>
      <form onSubmit={saveProfile} className="surface p-5 sm:p-7">
        <h2 className="font-serif text-xl text-primary">Profil</h2>
        <div className="mt-5 space-y-4"><Input label="Nama" required disabled={!user} value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} /><Input label="Email" type="email" required disabled={!user} value={profile.email} onChange={(event) => setProfile({ ...profile, email: event.target.value })} /></div>
        <Button className="mt-6" disabled={!user}>Simpan profil</Button>
      </form>
      <form onSubmit={savePassword} className="surface p-5 sm:p-7">
        <h2 className="font-serif text-xl text-primary">Keamanan</h2>
        <div className="mt-5 space-y-4"><Input label="Password saat ini" type="password" required minLength={8} value={password.current_password} onChange={(event) => setPassword({ ...password, current_password: event.target.value })} /><Input label="Password baru" type="password" required minLength={8} value={password.new_password} onChange={(event) => setPassword({ ...password, new_password: event.target.value })} /><Input label="Konfirmasi password baru" type="password" required minLength={8} value={password.confirm} onChange={(event) => setPassword({ ...password, confirm: event.target.value })} /></div>
        <Button className="mt-6">Ganti password</Button>
      </form>
    </div>
  </>;
}

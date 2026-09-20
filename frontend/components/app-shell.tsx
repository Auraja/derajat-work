"use client";

import {
  Bars3Icon,
  BookOpenIcon,
  BoltIcon,
  BookmarkSquareIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Cog6ToothIcon,
  DocumentDuplicateIcon,
  FolderIcon,
  HomeIcon,
  RectangleStackIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { makeBackgroundInert } from "@/components/ui/modal-accessibility";
import { WORKSPACES_CHANGED_EVENT } from "@/components/workspace-collection";
import { api } from "@/lib/api";
import type { User, Workspace } from "@/lib/types";

const moduleIcons: Record<string, typeof HomeIcon> = {
  teaching: BookOpenIcon,
  files: RectangleStackIcon,
  documents: DocumentDuplicateIcon,
  projects: FolderIcon,
};
const moduleLabels: Record<string, string> = {
  teaching: "Mengajar",
  files: "Berkas",
  documents: "Dokumen",
  projects: "Proyek",
  research: "Riset",
  notes: "Catatan",
  clients: "Klien",
};
const drawerFocusable = [
  "button:not([disabled]):not([tabindex=\"-1\"])",
  "[href]:not([tabindex=\"-1\"])",
  "input:not([disabled]):not([tabindex=\"-1\"])",
  "select:not([disabled]):not([tabindex=\"-1\"])",
  "textarea:not([disabled]):not([tabindex=\"-1\"])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function NavLink({
  href,
  label,
  icon: Icon,
  onClick,
}: {
  href: string;
  label: string;
  icon: typeof HomeIcon;
  onClick?: () => void;
}) {
  const pathname = usePathname();
  const active = href.includes("#") ? false : pathname === href;
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`sidebar-link ${active ? "active" : ""}`}
    >
      <Icon className="h-[17px] w-[17px]" />
      <span>{label}</span>
    </Link>
  );
}

function Sidebar({ close, desktopClose }: { close?: () => void; desktopClose?: () => void }) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const pathname = usePathname();
  const load = useCallback(() => {
    api<Workspace[]>("/workspaces")
      .then((data) => setWorkspaces(Array.isArray(data) ? data : []))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    load();
    window.addEventListener(WORKSPACES_CHANGED_EVENT, load);
    return () => window.removeEventListener(WORKSPACES_CHANGED_EVENT, load);
  }, [load]);

  return (
    <aside className="sidebar-shell" aria-label="Navigasi utama">
      <div className="sidebar-brand">
        <Link href="/dashboard" onClick={close} className="flex items-center gap-3">
          <span className="brand-seal">D</span>
          <span>
            <strong>Derajat</strong>
            <small>Ruang pribadi</small>
          </span>
        </Link>
        {close && (
          <button aria-label="Tutup navigasi" onClick={close} className="icon-button-dark">
            <XMarkIcon className="h-5 w-5" />
          </button>
        )}
        {desktopClose && (
          <button aria-label="Tutup navigasi desktop" onClick={desktopClose} className="icon-button-dark">
            <ChevronLeftIcon className="h-5 w-5" />
          </button>
        )}
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-5">
        <p className="sidebar-label">Meja Anda</p>
        <NavLink href="/dashboard" label="Beranda" icon={HomeIcon} onClick={close} />
        <NavLink href="/kanban" label="Kanban" icon={RectangleStackIcon} onClick={close} />
        <div className="mt-7 mb-2 flex items-center justify-between px-3">
          <p className="sidebar-label m-0 p-0">Ruang pilihan</p>
        </div>
        <div className="space-y-1">
          {workspaces.length === 0 && (
            <p className="px-3 py-3 text-xs leading-5 text-[#bdb4a7]">
              Belum ada ruang. Buat dari halaman beranda.
            </p>
          )}
          {workspaces.map((workspace) => {
            const open =
              expanded[workspace.slug] ?? pathname.startsWith(`/workspaces/${workspace.slug}`);
            const regionId = `workspace-nav-${workspace.id}`;
            return (
              <div key={workspace.id}>
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={regionId}
                  onClick={() =>
                    setExpanded((current) => ({ ...current, [workspace.slug]: !open }))
                  }
                  className="sidebar-workspace"
                >
                  <BookmarkSquareIcon className="h-[17px] w-[17px] shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{workspace.name}</span>
                  {open ? (
                    <ChevronDownIcon className="h-4 w-4" />
                  ) : (
                    <ChevronRightIcon className="h-4 w-4" />
                  )}
                </button>
                {open && (
                  <div id={regionId} className="sidebar-nested">
                    <NavLink
                      href={`/workspaces/${workspace.slug}`}
                      label="Ringkasan"
                      icon={HomeIcon}
                      onClick={close}
                    />
                    {(workspace.modules ?? []).map((module) => (
                      <NavLink
                        key={module.id}
                        href={`/workspaces/${workspace.slug}/${module.slug}`}
                        label={moduleLabels[module.slug] ?? module.name}
                        icon={moduleIcons[module.slug] ?? FolderIcon}
                        onClick={close}
                      />
                    ))}
                    <NavLink
                      href={`/workspaces/${workspace.slug}#skills`}
                      label="Skills"
                      icon={BoltIcon}
                      onClick={close}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-8 space-y-1 border-t border-[#3d362c] pt-5">
          <NavLink href="/library" label="Pustaka" icon={BookOpenIcon} onClick={close} />
          <NavLink
            href="/templates"
            label="Template"
            icon={DocumentDuplicateIcon}
            onClick={close}
          />
          <NavLink
            href="/settings"
            label="Pengaturan"
            icon={Cog6ToothIcon}
            onClick={close}
          />
        </div>
      </nav>
      <div className="sidebar-foot">
        <span className="private-dot" />Derajat Salim Wibowo
      </div>
    </aside>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [drawer, setDrawer] = useState(false);
  const [desktopNavigation, setDesktopNavigation] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [menu, setMenu] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const menuContainer = useRef<HTMLDivElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const drawerTriggerRef = useRef<HTMLButtonElement>(null);
  const mainContentRef = useRef<HTMLElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const parts = pathname.split("/").filter(Boolean);
  const workspaceSlug = parts[0] === "workspaces" ? parts[1] : undefined;
  const workspaceLabel = workspaceSlug?.replaceAll("-", " ");
  const sectionLabel =
    workspaceSlug && parts[2]
      ? moduleLabels[parts[2]] ?? parts[2].replaceAll("-", " ")
      : parts[0] === "dashboard"
        ? "beranda"
        : parts[0]?.replaceAll("-", " ") || "beranda";

  useEffect(() => {
    api<User>("/auth/me").then(setUser).catch(() => undefined);
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        if (window.localStorage.getItem("derajat.desktop-navigation") === "closed") {
          setDesktopNavigation(false);
        }
      } catch {
        // Navigation remains open if browser storage is unavailable.
      }
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  function setDesktopNavigationOpen(open: boolean) {
    setDesktopNavigation(open);
    try {
      window.localStorage.setItem("derajat.desktop-navigation", open ? "open" : "closed");
    } catch {
      // The in-memory preference still applies for this visit.
    }
  }

  useEffect(() => {
    const desktop = window.matchMedia?.("(min-width: 1024px)");
    if (!desktop) return;
    const closeDrawerAtDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) setDrawer(false);
    };
    desktop.addEventListener("change", closeDrawerAtDesktop);
    return () => desktop.removeEventListener("change", closeDrawerAtDesktop);
  }, []);

  useEffect(() => {
    if (!menu) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMenu(false);
        menuTriggerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [menu]);

  useEffect(() => {
    if (!menu) return;
    const closeOutside = (event: MouseEvent) => {
      if (!menuContainer.current?.contains(event.target as Node)) setMenu(false);
    };
    document.addEventListener("mousedown", closeOutside);
    return () => document.removeEventListener("mousedown", closeOutside);
  }, [menu]);

  useEffect(() => {
    if (!drawer) return;
    const previousOverflow = document.body.style.overflow;
    const drawerElement = drawerRef.current;
    const drawerTrigger = drawerTriggerRef.current;
    const restoreBackground = drawerElement
      ? makeBackgroundInert(drawerElement)
      : () => undefined;
    const focusable = () => {
      const elements = Array.from(
        drawerElement?.querySelectorAll<HTMLElement>(drawerFocusable) ?? [],
      );
      const close = drawerElement?.querySelector<HTMLElement>(
        '[aria-label="Tutup navigasi"]',
      );
      return close
        ? [close, ...elements.filter((element) => element !== close)]
        : elements;
    };

    document.body.style.overflow = "hidden";
    focusable()[0]?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setDrawer(false);
        return;
      }
      if (event.key !== "Tab") return;
      const elements = focusable();
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (!first || !last) return;
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
      drawerTrigger?.focus();
    };
  }, [drawer]);

  async function logout() {
    setLogoutError(null);
    try {
      await api("/auth/logout", { method: "POST" });
    } catch {
      setLogoutError("Gagal keluar. Silakan coba lagi.");
      return;
    }
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-canvas">
      <a
        href="#main-content"
        onClick={() => mainContentRef.current?.focus()}
        className="fixed left-4 top-4 z-[60] -translate-y-24 rounded-md bg-primary px-4 py-2 text-white focus:translate-y-0"
      >
        Lewati ke konten utama
      </a>
      {desktopNavigation && (
        <div id="desktop-navigation" className="fixed inset-y-0 left-0 z-30 hidden w-[232px] lg:block">
          <Sidebar desktopClose={() => setDesktopNavigationOpen(false)} />
        </div>
      )}
      {drawer && (
        <div
          ref={drawerRef}
          id="mobile-navigation"
          role="dialog"
          aria-modal="true"
          aria-label="Navigasi seluler"
          className="fixed inset-0 z-50 lg:hidden"
        >
          <button
            aria-hidden="true"
            tabIndex={-1}
            className="absolute inset-0 bg-[#17130e]/65 backdrop-blur-sm"
            onClick={() => setDrawer(false)}
          />
          <div className="relative h-full w-[min(19rem,88vw)]">
            <Sidebar close={() => setDrawer(false)} />
          </div>
        </div>
      )}
      <div className={`transition-[padding] duration-200 ${desktopNavigation ? "lg:pl-[232px]" : "lg:pl-0"}`}>
        <header className="topbar">
          <button
            ref={drawerTriggerRef}
            aria-label="Buka navigasi"
            aria-controls="mobile-navigation"
            aria-expanded={drawer}
            className="icon-button mobile-nav-trigger"
            onClick={() => setDrawer(true)}
          >
            <Bars3Icon className="h-6 w-6" />
          </button>
          {!desktopNavigation && (
            <button
              aria-label="Buka navigasi desktop"
              aria-controls="desktop-navigation"
              aria-expanded="false"
              className="icon-button desktop-nav-trigger"
              onClick={() => setDesktopNavigationOpen(true)}
            >
              <Bars3Icon className="h-5 w-5" />
            </button>
          )}
          <nav aria-label="Konteks halaman" className="min-w-0 flex-1 truncate text-xs text-muted">
            <span className="capitalize font-semibold text-primary">{sectionLabel}</span>
            {workspaceLabel && <span className="ml-2 capitalize text-muted">· {workspaceLabel}</span>}
          </nav>
          <div ref={menuContainer} className="relative ml-auto">
            <button
              ref={menuTriggerRef}
              aria-label="Menu akun"
              aria-controls="account-menu"
              aria-expanded={menu}
              onClick={() => setMenu((value) => !value)}
              className="profile-trigger"
            >
              <span className="profile-seal">D</span>
              <span className="hidden sm:block">
                <span className="block text-sm font-semibold text-primary">
                  Derajat Salim Wibowo
                </span>
                <span className="block text-[.67rem] tracking-wide text-muted">Personal workspace</span>
              </span>
              <ChevronDownIcon className="hidden h-4 w-4 text-muted sm:block" />
            </button>
            {menu && (
              <div id="account-menu" className="profile-menu">
                <div className="border-b border-line px-3 py-2">
                  <p className="truncate text-xs text-muted">{user?.email ?? "Akun aktif"}</p>
                </div>
                <Link
                  href="/settings"
                  className="menu-item"
                  onClick={() => setMenu(false)}
                >
                  Pengaturan akun
                </Link>
                <Button variant="ghost" className="w-full justify-start" onClick={logout}>
                  Keluar
                </Button>
                {logoutError && (
                  <p role="alert" className="px-3 py-2 text-xs text-red-700">
                    {logoutError}
                  </p>
                )}
              </div>
            )}
          </div>
        </header>
        <main
          ref={mainContentRef}
          id="main-content"
          tabIndex={-1}
          className="mx-auto w-full max-w-[1180px] px-4 py-8 sm:px-7 lg:px-10 lg:py-10"
        >
          {children}
        </main>
      </div>
    </div>
  );
}

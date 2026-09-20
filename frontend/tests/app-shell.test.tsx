import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/app-shell";
import { api } from "@/lib/api";

const replace = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({ replace, refresh }),
}));
vi.mock("@/lib/api", () => ({ api: vi.fn() }));

const apiMock = vi.mocked(api);
const stored = new Map<string, string>();
const localStorageMock = {
  clear: () => stored.clear(),
  getItem: (key: string) => stored.get(key) ?? null,
  setItem: (key: string, value: string) => stored.set(key, value),
  removeItem: (key: string) => stored.delete(key),
  key: (index: number) => Array.from(stored.keys())[index] ?? null,
  get length() { return stored.size; },
};

describe("AppShell accessibility", () => {
  beforeEach(() => {
    stored.clear();
    vi.stubGlobal("localStorage", localStorageMock);
    replace.mockReset();
    refresh.mockReset();
    apiMock.mockImplementation(async (path) => {
      if (path === "/auth/me") {
        return { id: 1, name: "Dedi", email: "dedi@example.test" };
      }
      return [];
    });
  });

  it("can close and reopen the desktop navigation", () => {
    render(<AppShell><p>Isi</p></AppShell>);
    expect(screen.getByLabelText("Navigasi utama")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Buka navigasi" })).toHaveClass("mobile-nav-trigger");

    fireEvent.click(screen.getByRole("button", { name: "Tutup navigasi desktop" }));

    expect(screen.queryByLabelText("Navigasi utama")).not.toBeInTheDocument();
    expect(window.localStorage.getItem("derajat.desktop-navigation")).toBe("closed");
    const desktopTrigger = screen.getByRole("button", { name: "Buka navigasi desktop" });
    expect(desktopTrigger).toHaveClass("desktop-nav-trigger");
    fireEvent.click(desktopTrigger);
    expect(screen.getByLabelText("Navigasi utama")).toBeInTheDocument();
  });

  it("shows the owner's personal name in the simple top bar", () => {
    render(<AppShell><p>Isi</p></AppShell>);
    const account = screen.getByRole("button", { name: "Menu akun" });
    expect(within(account).getByText("Derajat Salim Wibowo")).toBeInTheDocument();
  });

  it("moves focus from the first-focusable skip link to the main content", () => {
    render(<AppShell><p>Isi</p></AppShell>);
    const skipLink = screen.getByRole("link", { name: "Lewati ke konten utama" });
    const main = screen.getByRole("main");

    expect(document.querySelector<HTMLElement>("a[href], button, [tabindex='0']")).toBe(skipLink);
    expect(skipLink).toHaveAttribute("href", "#main-content");
    expect(main).toHaveAttribute("id", "main-content");
    expect(main).toHaveAttribute("tabindex", "-1");

    skipLink.focus();
    fireEvent.click(skipLink);
    expect(main).toHaveFocus();
  });

  it("exposes and closes the mobile navigation with Escape", async () => {
    render(<AppShell><p>Isi</p></AppShell>);
    const trigger = screen.getByRole("button", { name: "Buka navigasi" });
    trigger.focus();

    expect(trigger).toHaveAttribute("aria-controls", "mobile-navigation");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    const drawer = screen.getByRole("dialog", { name: "Navigasi seluler" });
    const close = within(drawer).getByRole("button", { name: "Tutup navigasi" });
    const last = within(drawer).getAllByRole("link").at(-1)!;
    expect(close).toHaveFocus();
    expect(trigger.closest("[inert]")).not.toBeNull();

    fireEvent.keyDown(drawer, { key: "Tab", shiftKey: true });
    expect(last).toHaveFocus();
    fireEvent.keyDown(drawer, { key: "Tab" });
    expect(close).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(document.getElementById("mobile-navigation")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(trigger.closest("[inert]")).toBeNull();
  });

  it("uses normal disclosure semantics for the account popup", () => {
    render(<AppShell><p>Isi</p></AppShell>);
    const trigger = screen.getByRole("button", { name: "Menu akun" });

    expect(trigger).toHaveAttribute("aria-controls", "account-menu");
    expect(trigger).not.toHaveAttribute("aria-haspopup");
    fireEvent.click(trigger);

    const popup = document.getElementById("account-menu")!;
    expect(popup).not.toHaveAttribute("role");
    expect(within(popup).getByRole("link", { name: "Pengaturan akun" })).not.toHaveAttribute("role");
    expect(within(popup).getByRole("button", { name: "Keluar" })).not.toHaveAttribute("role");
  });

  it("keeps the user on the protected page when logout fails", async () => {
    apiMock.mockImplementation(async (path) => {
      if (path === "/auth/me") {
        return { id: 1, name: "Dedi", email: "dedi@example.test" };
      }
      if (path === "/auth/logout") throw new Error("Jaringan terputus");
      return [];
    });
    render(<AppShell><p>Isi</p></AppShell>);

    fireEvent.click(screen.getByRole("button", { name: "Menu akun" }));
    fireEvent.click(screen.getByRole("button", { name: "Keluar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Gagal keluar. Silakan coba lagi.",
    );
    expect(replace).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("closes the account disclosure with Escape and restores trigger focus", () => {
    render(<AppShell><p>Isi</p></AppShell>);
    const trigger = screen.getByRole("button", { name: "Menu akun" });

    trigger.focus();
    fireEvent.click(trigger);
    screen.getByRole("link", { name: "Pengaturan akun" }).focus();
    fireEvent.keyDown(document, { key: "Escape" });

    expect(document.getElementById("account-menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("labels and dismisses the account menu outside its container", async () => {
    render(<AppShell><p>Isi</p></AppShell>);
    const trigger = screen.getByRole("button", { name: "Menu akun" });

    expect(trigger).toHaveAttribute("aria-controls", "account-menu");
    fireEvent.click(trigger);
    expect(document.getElementById("account-menu")).toBeInTheDocument();
    fireEvent.mouseDown(document.body);

    await waitFor(() => expect(document.getElementById("account-menu")).not.toBeInTheDocument());
  });

  it("closes the mobile drawer and unlocks body scrolling at the desktop breakpoint", () => {
    const listeners = new Set<(event: MediaQueryListEvent) => void>();
    const mediaQuery = {
      matches: false,
      media: "(min-width: 1024px)",
      onchange: null,
      addEventListener: vi.fn((_type, listener) => listeners.add(listener)),
      removeEventListener: vi.fn((_type, listener) => listeners.delete(listener)),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as unknown as MediaQueryList;
    const matchMedia = vi.fn(() => mediaQuery);
    vi.stubGlobal("matchMedia", matchMedia);

    render(<AppShell><p>Isi</p></AppShell>);
    fireEvent.click(screen.getByRole("button", { name: "Buka navigasi" }));
    expect(screen.getByRole("dialog", { name: "Navigasi seluler" })).toBeInTheDocument();
    expect(document.body.style.overflow).toBe("hidden");

    act(() => {
      listeners.forEach((listener) =>
        listener({ matches: true, media: "(min-width: 1024px)" } as MediaQueryListEvent),
      );
    });

    expect(matchMedia).toHaveBeenCalledWith("(min-width: 1024px)");
    expect(screen.queryByRole("dialog", { name: "Navigasi seluler" })).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe("");
    vi.unstubAllGlobals();
  });
});

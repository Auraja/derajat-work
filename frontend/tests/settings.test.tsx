import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SettingsPage from "@/app/(protected)/settings/page";
import { api } from "@/lib/api";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("@/lib/api", () => ({ api: vi.fn() }));
vi.mock("@/components/ui/toast", () => ({ useToast: () => ({ show: vi.fn() }) }));

const apiMock = vi.mocked(api);
const stored = new Map<string, string>();

beforeEach(() => {
  stored.clear();
  document.documentElement.removeAttribute("data-theme");
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => stored.set(key, value),
    removeItem: (key: string) => stored.delete(key),
  });
  apiMock.mockImplementation(async (path) => path === "/auth/me" ? { id: 1, name: "Derajat Salim Wibowo", email: "derajat@example.test" } : {});
});

describe("Settings appearance", () => {
  it("applies and persists dark mode", () => {
    render(<SettingsPage />);
    const dark = screen.getByRole("button", { name: "Mode gelap" });

    fireEvent.click(dark);

    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(localStorage.getItem("derajat.theme")).toBe("dark");
    expect(dark).toHaveAttribute("aria-pressed", "true");
  });
});

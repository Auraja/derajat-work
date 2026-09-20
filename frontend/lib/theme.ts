export type ThemeMode = "light" | "dark";

export const THEME_STORAGE_KEY = "derajat.theme";

export function readTheme(): ThemeMode {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function applyTheme(theme: ThemeMode, persist = true): void {
  document.documentElement.dataset.theme = theme;
  if (!persist) return;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // The selected theme still applies for the current page.
  }
}

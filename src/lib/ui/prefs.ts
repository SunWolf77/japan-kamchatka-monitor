/**
 * UI preferences — progressive disclosure + theme + header collapse.
 * Stored in localStorage; mobile quiet defaults on first visit (<768px).
 */

const QUIET_KEY = "ses-jp-quiet-mode";
const QUIET_SOURCE_KEY = "ses-jp-quiet-source"; // user | auto-mobile
const SUPT_FOCUS_KEY = "ses-jp-supt-focus";
const THEME_KEY = "ses-jp-theme"; // light | dark | system
const HEADER_COLLAPSE_KEY = "ses-jp-header-collapsed";

export type ThemeMode = "light" | "dark" | "system";
export type QuietSource = "user" | "auto-mobile" | "default";

export function isMobileViewport(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 767px)").matches;
}

export function getQuietMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const v = window.localStorage.getItem(QUIET_KEY);
    if (v === "1") return true;
    if (v === "0") return false;
    // First visit: mobile defaults to quiet (cognitive-load mitigation)
    if (isMobileViewport()) {
      setQuietMode(true, "auto-mobile");
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function getQuietSource(): QuietSource {
  if (typeof window === "undefined") return "default";
  try {
    const s = window.localStorage.getItem(QUIET_SOURCE_KEY);
    if (s === "user" || s === "auto-mobile") return s;
    return "default";
  } catch {
    return "default";
  }
}

export function setQuietMode(on: boolean, source: QuietSource = "user"): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(QUIET_KEY, on ? "1" : "0");
    window.localStorage.setItem(QUIET_SOURCE_KEY, source);
  } catch {
    /* */
  }
}

/** true = focus (default); false = show advanced SUPT panels */
export function getSuptFocusMode(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const v = window.localStorage.getItem(SUPT_FOCUS_KEY);
    if (v == null) return true;
    return v === "1";
  } catch {
    return true;
  }
}

export function setSuptFocusMode(focus: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SUPT_FOCUS_KEY, focus ? "1" : "0");
  } catch {
    /* */
  }
}

/** null = follow responsive default (mobile/short → collapsed on map) */
export function getHeaderCollapsedPref(): boolean | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(HEADER_COLLAPSE_KEY);
    if (v === "1") return true;
    if (v === "0") return false;
  } catch {
    /* */
  }
  return null;
}

export function setHeaderCollapsedPref(collapsed: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(HEADER_COLLAPSE_KEY, collapsed ? "1" : "0");
  } catch {
    /* */
  }
}

export function getThemeMode(): ThemeMode {
  if (typeof window === "undefined") return "dark";
  try {
    const v = window.localStorage.getItem(THEME_KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
    return "dark";
  } catch {
    return "dark";
  }
}

export function setThemeMode(mode: ThemeMode): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(THEME_KEY, mode);
  } catch {
    /* */
  }
  applyTheme(mode);
}

export function resolveTheme(mode: ThemeMode): "light" | "dark" {
  if (mode === "system" && typeof window !== "undefined") {
    return window.matchMedia("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark";
  }
  return mode === "light" ? "light" : "dark";
}

export function applyTheme(mode?: ThemeMode): "light" | "dark" {
  if (typeof document === "undefined") return "dark";
  const m = mode ?? getThemeMode();
  const resolved = resolveTheme(m);
  const root = document.documentElement;
  root.classList.toggle("light", resolved === "light");
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
  root.dataset.theme = resolved;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute("content", resolved === "light" ? "#f4f5f7" : "#0b0c0e");
  }
  return resolved;
}

/** Cycle dark → light → system → dark */
export function cycleTheme(mode: ThemeMode): ThemeMode {
  if (mode === "dark") return "light";
  if (mode === "light") return "system";
  return "dark";
}

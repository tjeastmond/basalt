"use client";

import * as React from "react";

import { THEME_STORAGE_KEY } from "@/lib/theme-init-script";

const MEDIA = "(prefers-color-scheme: dark)";

export type ThemeName = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

function systemPreference(): ResolvedTheme {
  return window.matchMedia(MEDIA).matches ? "dark" : "light";
}

function resolveTheme(theme: ThemeName): ResolvedTheme {
  return theme === "system" ? systemPreference() : theme;
}

function disableTransitions(): () => void {
  const style = document.createElement("style");
  style.appendChild(
    document.createTextNode(
      "*,*::before,*::after{-webkit-transition:none!important;-moz-transition:none!important;-o-transition:none!important;-ms-transition:none!important;transition:none!important}",
    ),
  );
  document.head.appendChild(style);
  return () => {
    window.getComputedStyle(document.body);
    setTimeout(() => document.head.removeChild(style), 1);
  };
}

function paintTheme(resolved: ResolvedTheme, disableTransitionOnChange: boolean): void {
  const root = document.documentElement;
  const done = disableTransitionOnChange ? disableTransitions() : null;
  root.classList.remove("light", "dark");
  root.classList.add(resolved);
  root.style.colorScheme = resolved;
  done?.();
}

export type ThemeContextValue = {
  theme: ThemeName;
  setTheme: React.Dispatch<React.SetStateAction<ThemeName>>;
  resolvedTheme: ResolvedTheme | undefined;
  themes: ThemeName[];
};

const ThemeContext = React.createContext<ThemeContextValue | undefined>(undefined);

export function useTheme(): ThemeContextValue {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) {
    return {
      theme: "system",
      setTheme: () => {},
      resolvedTheme: undefined,
      themes: ["light", "dark", "system"],
    };
  }
  return ctx;
}

export type ThemeProviderProps = {
  children: React.ReactNode;
  /** Stored value when user has not chosen yet (after blocking script + hydration). */
  defaultTheme?: ThemeName;
  enableSystem?: boolean;
  disableTransitionOnChange?: boolean;
  /** Kept for API compatibility with next-themes; only `class` is supported. */
  attribute?: "class";
};

export function ThemeProvider({
  children,
  defaultTheme = "system",
  enableSystem = true,
  disableTransitionOnChange = false,
}: ThemeProviderProps) {
  const [theme, setThemeState] = React.useState<ThemeName>(defaultTheme);
  const [resolvedTheme, setResolvedTheme] = React.useState<ResolvedTheme | undefined>(undefined);
  /** Skip the theme-sync effect once so we do not repaint `defaultTheme` before localStorage is read. */
  const skipThemeSyncOnce = React.useRef(true);

  React.useLayoutEffect(() => {
    let next: ThemeName = defaultTheme;
    try {
      const raw = localStorage.getItem(THEME_STORAGE_KEY);
      if (raw === "light" || raw === "dark" || raw === "system") {
        next = raw;
      }
    } catch {
      /* ignore */
    }
    if (!enableSystem && next === "system") {
      next = "light";
    }
    const resolved = resolveTheme(next);
    setThemeState(next);
    setResolvedTheme(resolved);
    paintTheme(resolved, disableTransitionOnChange);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, [defaultTheme, enableSystem, disableTransitionOnChange]);

  React.useLayoutEffect(() => {
    if (skipThemeSyncOnce.current) {
      skipThemeSyncOnce.current = false;
      return;
    }
    const resolved = resolveTheme(theme);
    setResolvedTheme(resolved);
    paintTheme(resolved, disableTransitionOnChange);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme, disableTransitionOnChange]);

  React.useEffect(() => {
    if (theme !== "system") {
      return;
    }
    const mq = window.matchMedia(MEDIA);
    const onChange = () => {
      const resolved = systemPreference();
      setResolvedTheme(resolved);
      paintTheme(resolved, disableTransitionOnChange);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme, disableTransitionOnChange]);

  React.useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== THEME_STORAGE_KEY || e.newValue == null) {
        return;
      }
      if (e.newValue === "light" || e.newValue === "dark" || e.newValue === "system") {
        setThemeState(e.newValue);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const themes = React.useMemo(
    () => (enableSystem ? (["light", "dark", "system"] as const) : (["light", "dark"] as const)),
    [enableSystem],
  );

  const value = React.useMemo(
    () => ({
      theme,
      setTheme: setThemeState,
      resolvedTheme,
      themes: [...themes],
    }),
    [theme, resolvedTheme, themes],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

import { useEffect, useState } from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import {
  applyTheme,
  cycleTheme,
  getThemeMode,
  setThemeMode,
  type ThemeMode,
} from "@/lib/ui/prefs";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const [mode, setMode] = useState<ThemeMode>("dark");
  const [resolved, setResolved] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const m = getThemeMode();
    setMode(m);
    setResolved(applyTheme(m));
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => {
      if (getThemeMode() === "system") setResolved(applyTheme("system"));
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const next = () => {
    const n = cycleTheme(mode);
    setThemeMode(n);
    setMode(n);
    setResolved(applyTheme(n));
  };

  const Icon = mode === "system" ? Monitor : resolved === "light" ? Sun : Moon;
  const label =
    mode === "system" ? "System" : mode === "light" ? "Light" : "Dark";

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={next}
      className={cn("h-9 px-2.5", className)}
      title={`Theme: ${label} — click to cycle dark → light → system`}
      aria-label={`Theme ${label}`}
    >
      <Icon className="size-3.5" />
      <span className="hidden sm:inline">{label}</span>
    </Button>
  );
}

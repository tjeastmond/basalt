import { ThemeToggle } from "@/components/theme-toggle";

export function AppHeader() {
  return (
    <header className="flex h-14 items-center justify-between border-b border-border px-4">
      <span className="text-sm font-semibold tracking-tight">Basalt</span>
      <ThemeToggle />
    </header>
  );
}

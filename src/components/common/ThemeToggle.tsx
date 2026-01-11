import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  collapsed?: boolean;
}

export function ThemeToggle({ collapsed }: ThemeToggleProps) {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const stored = localStorage.getItem("theme") as "light" | "dark" | null;
    const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initial = stored || (systemPrefersDark ? "dark" : "light");
    setTheme(initial);
    document.documentElement.classList.toggle("dark", initial === "dark");
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.classList.toggle("dark", newTheme === "dark");
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleTheme}
      className={cn(
        "relative w-full justify-start gap-3 px-3 py-2.5 text-sm font-medium",
        "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        "group overflow-hidden",
        collapsed && "justify-center px-2"
      )}
    >
      <div className="relative h-5 w-5 shrink-0">
        <Sun 
          className={cn(
            "absolute inset-0 h-5 w-5 transition-all duration-500",
            theme === "dark" 
              ? "rotate-90 scale-0 opacity-0" 
              : "rotate-0 scale-100 opacity-100"
          )} 
        />
        <Moon 
          className={cn(
            "absolute inset-0 h-5 w-5 transition-all duration-500",
            theme === "dark" 
              ? "rotate-0 scale-100 opacity-100" 
              : "-rotate-90 scale-0 opacity-0"
          )} 
        />
      </div>
      {!collapsed && (
        <span className="transition-all duration-200">
          {theme === "light" ? "Dark Mode" : "Light Mode"}
        </span>
      )}
      
      {/* Animated background glow */}
      <div 
        className={cn(
          "absolute inset-0 -z-10 opacity-0 transition-opacity duration-300 group-hover:opacity-100",
          theme === "dark" 
            ? "bg-gradient-to-r from-indigo-500/10 to-purple-500/10" 
            : "bg-gradient-to-r from-amber-500/10 to-orange-500/10"
        )}
      />
    </Button>
  );
}

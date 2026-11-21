"use client";

import * as React from "react";
import { Monitor, Moon, RefreshCw, Settings2, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";

import { cn } from "@/lib/utils";
import { IconButton } from "@/components/ui/icon-button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";

type ThemeCustomizerProps = {
  trigger?: React.ReactNode;
};

type ThemeMode = "light" | "dark" | "system";

const MODE_OPTIONS: Array<{
  value: ThemeMode;
  icon: React.ComponentType<{ className?: string }>;
  labelKey: "modeToggle.light" | "modeToggle.dark" | "modeToggle.system";
}> = [
  { value: "light", icon: Sun, labelKey: "modeToggle.light" },
  { value: "dark", icon: Moon, labelKey: "modeToggle.dark" },
  { value: "system", icon: Monitor, labelKey: "modeToggle.system" },
];

export function ThemeCustomizer({
  trigger,
}: Readonly<ThemeCustomizerProps> = {}) {
  const [mounted, setMounted] = React.useState(false);
  const t = useTranslations("CommonUi");
  const { theme, setTheme } = useTheme();
  const activeMode: ThemeMode =
    theme === "light" || theme === "dark" || theme === "system"
      ? theme
      : "system";

  const triggerNode = trigger ?? (
    <IconButton
      label={t("themeCustomizer.openLabel")}
      variant="outline"
      className="fixed bottom-4 right-4 z-50 size-11 border-border bg-surface shadow-soft hover:border-border-strong sm:size-10 supports-[padding:env(safe-area-inset-bottom)]:bottom-[calc(env(safe-area-inset-bottom)+1rem)] supports-[padding:env(safe-area-inset-right)]:right-[calc(env(safe-area-inset-right)+1rem)]"
    >
      <Settings2 className="size-5 text-foreground" />
    </IconButton>
  );

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>{triggerNode}</PopoverTrigger>
      <PopoverContent className="w-72 p-4" align="end" sideOffset={10}>
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <h4 className="text-compact font-semibold leading-none text-foreground">
                {t("themeCustomizer.title")}
              </h4>
              <p className="text-caption text-muted-foreground">
                {t("themeCustomizer.description")}
              </p>
            </div>
            <IconButton
              label={t("themeCustomizer.resetAppearance")}
              variant="ghost"
              onClick={() => setTheme("system")}
            >
              <RefreshCw className="size-4" />
            </IconButton>
          </div>

          <div className="space-y-2">
            <Label className="text-caption">
              {t("themeCustomizer.modeLabel")}
            </Label>
            <div
              role="group"
              className="flex gap-1 rounded-md border border-border bg-surface p-1"
            >
              {MODE_OPTIONS.map((option) => {
                const Icon = option.icon;
                const isActive = activeMode === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setTheme(option.value)}
                    aria-pressed={isActive}
                    data-active={isActive ? "true" : "false"}
                    className={cn(
                      "inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md px-2 text-caption font-medium transition-[background-color,border-color,color,opacity] duration-120 ease-spring motion-reduce:transition-none sm:min-h-8",
                      isActive
                        ? "bg-raised text-foreground ring-1 ring-border"
                        : "text-muted-foreground hover:bg-raised hover:text-foreground",
                    )}
                  >
                    <Icon className="size-3.5" />
                    {t(option.labelKey)}
                  </button>
                );
              })}
            </div>
          </div>

          <p className="border-t border-border pt-3 text-micro leading-4 text-subtle-foreground">
            {t("themeCustomizer.monochromeNote")}
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ModeToggle() {
  const { setTheme } = useTheme();
  const t = useTranslations("CommonUi");
  const menuItemClassName =
    "focus:bg-accent data-[highlighted]:bg-accent focus:text-accent-foreground data-[highlighted]:text-accent-foreground";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-11 pointer-fine:md:size-8"
          aria-label={t("modeToggle.ariaLabel")}
          title={t("modeToggle.ariaLabel")}
        >
          <Sun aria-hidden="true" className="size-5 dark:hidden" />
          <Moon aria-hidden="true" className="hidden size-5 dark:block" />
          <span className="sr-only">{t("modeToggle.ariaLabel")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8}>
        <DropdownMenuItem
          className={menuItemClassName}
          onClick={() => setTheme("light")}
        >
          {t("modeToggle.light")}
        </DropdownMenuItem>
        <DropdownMenuItem
          className={menuItemClassName}
          onClick={() => setTheme("dark")}
        >
          {t("modeToggle.dark")}
        </DropdownMenuItem>
        <DropdownMenuItem
          className={menuItemClassName}
          onClick={() => setTheme("system")}
        >
          {t("modeToggle.system")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

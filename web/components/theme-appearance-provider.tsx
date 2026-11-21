"use client";

import * as React from "react";

import { getClientStorage } from "@/lib/client-storage";
import {
  migrateLegacyThemeAppearance,
  SURFACE_THEME_STORAGE_KEY,
  THEME_APPEARANCE_CHANGED_EVENT,
  THEME_COLOR_STORAGE_KEY,
} from "@/lib/theme-surface";

const useIsomorphicLayoutEffect =
  globalThis.window === undefined ? React.useEffect : React.useLayoutEffect;

/**
 * One-way migration from the legacy palette picker to the monochrome skin.
 *
 * Light/dark/system preference is managed by next-themes; this component only
 * removes old named-surface and arbitrary-accent preferences (storage, cookie
 * and inline tokens). The monochrome palette itself lives in globals.css.
 */
export function ThemeAppearanceProvider() {
  useIsomorphicLayoutEffect(() => {
    migrateLegacyThemeAppearance(
      getClientStorage(),
      globalThis.document.documentElement,
      globalThis.document,
    );
  }, []);

  React.useEffect(() => {
    const migrate = () => {
      migrateLegacyThemeAppearance(
        getClientStorage(),
        globalThis.document.documentElement,
        globalThis.document,
      );
    };

    const handleStorage = (event: StorageEvent) => {
      if (
        event.key &&
        event.key !== SURFACE_THEME_STORAGE_KEY &&
        event.key !== THEME_COLOR_STORAGE_KEY
      ) {
        return;
      }
      migrate();
    };

    globalThis.window.addEventListener("storage", handleStorage);
    globalThis.window.addEventListener(THEME_APPEARANCE_CHANGED_EVENT, migrate);

    return () => {
      globalThis.window.removeEventListener("storage", handleStorage);
      globalThis.window.removeEventListener(
        THEME_APPEARANCE_CHANGED_EVENT,
        migrate,
      );
    };
  }, []);

  return null;
}

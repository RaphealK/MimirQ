// @vitest-environment happy-dom

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  clearLegacyInlineTokens,
  DEFAULT_SURFACE_THEME,
  migrateLegacyThemeAppearance,
  normalizeSurfaceTheme,
  SURFACE_THEME_COOKIE_KEY,
  SURFACE_THEME_STORAGE_KEY,
  THEME_COLOR_COOKIE_KEY,
  THEME_COLOR_STORAGE_KEY,
} from "./theme-surface";

function createStorage(values: Record<string, string>) {
  const data = new Map(Object.entries(values));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
  };
}

describe("graphite theme surface", () => {
  const css = fs.readFileSync(
    path.resolve(__dirname, "../app/globals.css"),
    "utf8",
  );

  it("pins the light graphite palette and the two radii", () => {
    expect(css).toContain("--background: 220 18% 95.5%");
    expect(css).toContain("--surface: 0 0% 100%");
    expect(css).toContain("--raised: 0 0% 100%");
    expect(css).toContain("--border: 220 14% 84%");
    expect(css).toContain("--border-strong: 220 12% 68%");
    expect(css).toContain("--foreground: 222 32% 11%");
    expect(css).toContain("--muted-foreground: 220 12% 34%");
    expect(css).toContain("--subtle-foreground: 220 10% 44%");
    expect(css).toContain("--primary: 221 84% 45%");
    expect(css).toContain("--primary-foreground: 0 0% 100%");
    expect(css).toContain("--accent: 262 68% 50%");
    expect(css).toContain("--chart-1: 221 84% 42%");
    expect(css).toContain("--radius-control: 4px");
    expect(css).toContain("--radius-panel: 6px");
    expect(css).toContain("--app-background-base: hsl(var(--background))");
    expect(css).toContain("--app-orb-primary-opacity: 0");
    expect(css).toContain("--app-orb-secondary-opacity: 0");
    expect(css).toContain("background-image: none");
  });

  it("pins the dark graphite palette used as the default appearance", () => {
    expect(css).toContain("--background: 222 30% 7%");
    expect(css).toContain("--surface: 222 22% 12.5%");
    expect(css).toContain("--raised: 222 20% 16%");
    expect(css).toContain("--border: 220 14% 23%");
    expect(css).toContain("--border-strong: 220 12% 36%");
    expect(css).toContain("--foreground: 220 24% 97%");
    expect(css).toContain("--muted-foreground: 220 14% 70%");
    expect(css).toContain("--subtle-foreground: 220 12% 58%");
    expect(css).toContain("--primary: 219 92% 64%");
    expect(css).toContain("--primary-foreground: 222 45% 9%");
    expect(css).toContain("--accent: 262 85% 72%");
    expect(css).toContain("--chart-1: 215 92% 66%");
  });

  it("uses real status hues and a signal-blue info tone", () => {
    expect(css).toContain("--success: 158 78% 26%");
    expect(css).toContain("--warning: 32 92% 44%");
    expect(css).toContain("--danger: 0 72% 44%");
    expect(css).toContain("--success: 158 68% 46%");
    expect(css).toContain("--warning: 38 95% 58%");
    expect(css).toContain("--danger: 0 80% 62%");
    expect(css).toContain("--info: 221 84% 45%");
    expect(css).toContain("--info: 219 92% 64%");
    expect(css).not.toContain("--engineering-");
    expect(css).not.toContain("202.7 59%");
    expect(css).not.toContain("203.1 24.5%");
  });

  it("no longer remaps raw Tailwind palettes onto a grey ramp", () => {
    for (const family of [
      "red",
      "orange",
      "amber",
      "yellow",
      "lime",
      "green",
      "emerald",
      "teal",
      "cyan",
      "sky",
      "blue",
      "indigo",
      "violet",
      "purple",
      "fuchsia",
      "pink",
      "rose",
      "slate",
      "gray",
      "zinc",
      "neutral",
      "stone",
    ]) {
      expect(css).not.toContain(`--color-${family}-`);
      expect(css).not.toContain(`--mono-`);
    }
  });

  it("keeps legacy named surfaces resolving to the single graphite skin", () => {
    expect(DEFAULT_SURFACE_THEME).toBe("graphite");
    expect(normalizeSurfaceTheme("ocean")).toBe("graphite");
    expect(normalizeSurfaceTheme("neutral")).toBe("graphite");
    expect(normalizeSurfaceTheme("deepsea")).toBe("graphite");
    expect(normalizeSurfaceTheme("earth")).toBe("graphite");
    expect(normalizeSurfaceTheme(undefined)).toBe("graphite");
  });

  it("clears legacy inline tokens without writing colours back", () => {
    const root = document.createElement("html");
    root.style.setProperty("--primary", "199 89% 48%");
    root.style.setProperty("--ring", "201 96% 32%");
    root.style.setProperty("--focus", "199 89% 48%");
    root.style.setProperty("--accent", "225 80% 50%");
    root.style.setProperty("--ink", "225 80% 50%");

    clearLegacyInlineTokens(root);

    for (const token of [
      "--primary",
      "--ring",
      "--focus",
      "--accent",
      "--ink",
    ]) {
      expect(root.style.getPropertyValue(token)).toBe("");
    }
  });

  it("removes stored legacy preferences and inline overrides during migration", () => {
    const storage = createStorage({
      [SURFACE_THEME_STORAGE_KEY]: "neutral",
      [THEME_COLOR_STORAGE_KEY]: "#e11d48",
    });
    const cookieWrites: string[] = [];
    const cookieTarget = {
      set cookie(value: string) {
        cookieWrites.push(value);
      },
    };
    const root = document.createElement("html");
    root.classList.add("dark");
    root.dataset.surfaceTheme = "neutral";
    root.style.setProperty("--primary", "199 89% 48%");
    root.style.setProperty("--accent", "225 80% 50%");

    migrateLegacyThemeAppearance(storage, root, cookieTarget);

    expect(storage.data.has(SURFACE_THEME_STORAGE_KEY)).toBe(false);
    expect(storage.data.has(THEME_COLOR_STORAGE_KEY)).toBe(false);
    expect(cookieWrites).toContainEqual(
      expect.stringContaining(`${SURFACE_THEME_COOKIE_KEY}=;`),
    );
    expect(cookieWrites).toContainEqual(
      expect.stringContaining(`${THEME_COLOR_COOKIE_KEY}=;`),
    );
    expect(root.dataset.surfaceTheme).toBeUndefined();
    expect(root.style.getPropertyValue("--primary")).toBe("");
    expect(root.style.getPropertyValue("--accent")).toBe("");
    expect(root.classList.contains("dark")).toBe(true);
  });

  it("never exposes an API that can apply a stored colour", () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, "./theme-surface.ts"),
      "utf8",
    );
    expect(source).not.toContain("getThemeColorTokens");
    expect(source).not.toContain("ENGINEERING_ACCENT");
    expect(source).not.toMatch(/setProperty\(\s*"--/);
  });
});

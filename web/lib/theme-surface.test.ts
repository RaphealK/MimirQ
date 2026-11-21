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

describe("monochrome theme surface", () => {
  const css = fs.readFileSync(
    path.resolve(__dirname, "../app/globals.css"),
    "utf8",
  );

  it("pins the light monochrome palette and the two radii", () => {
    expect(css).toContain("--background: 0 0% 100%");
    expect(css).toContain("--surface: 220 20% 98.5%");
    expect(css).toContain("--raised: 0 0% 100%");
    expect(css).toContain("--border: 220 15% 89%");
    expect(css).toContain("--border-strong: 220 13% 78%");
    expect(css).toContain("--foreground: 222 24% 11%");
    expect(css).toContain("--muted-foreground: 220 9% 40%");
    expect(css).toContain("--subtle-foreground: 220 8% 48%");
    expect(css).toContain("--primary: 222 24% 11%");
    expect(css).toContain("--primary-foreground: 0 0% 100%");
    expect(css).toContain("--radius-control: 4px");
    expect(css).toContain("--radius-panel: 6px");
    expect(css).toContain("--app-background-base: hsl(var(--background))");
    expect(css).toContain("--app-orb-primary-opacity: 0");
    expect(css).toContain("--app-orb-secondary-opacity: 0");
    expect(css).toContain("background-image: none");
  });

  it("pins the dark monochrome palette used as the default appearance", () => {
    expect(css).toContain("--background: 220 13% 6.5%");
    expect(css).toContain("--surface: 220 12% 9%");
    expect(css).toContain("--raised: 220 11% 12.5%");
    expect(css).toContain("--border: 220 10% 17%");
    expect(css).toContain("--border-strong: 220 9% 26%");
    expect(css).toContain("--foreground: 220 16% 96%");
    expect(css).toContain("--muted-foreground: 220 9% 64%");
    expect(css).toContain("--subtle-foreground: 220 8% 52%");
    expect(css).toContain("--primary: 220 16% 96%");
    expect(css).toContain("--primary-foreground: 220 13% 7%");
  });

  it("keeps status hues limited to success, warning and danger", () => {
    expect(css).toContain("--success: 152 58% 32%");
    expect(css).toContain("--warning: 32 95% 44%");
    expect(css).toContain("--danger: 0 68% 45%");
    expect(css).toContain("--success: 152 58% 38%");
    expect(css).toContain("--warning: 38 92% 50%");
    expect(css).toContain("--danger: 0 72% 51%");
    expect(css).toContain("--info: 222 24% 11%");
    expect(css).toContain("--info: 220 16% 96%");
    expect(css).not.toContain("--engineering-");
    expect(css).not.toContain("202.7 59%");
    expect(css).not.toContain("203.1 24.5%");
  });

  it("maps historical Tailwind palette slots onto the grey ramp", () => {
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
    ]) {
      expect(css).toContain(`--color-${family}-500: hsl(var(--mono-500))`);
    }
  });

  it("keeps legacy named surfaces resolving to the single monochrome skin", () => {
    expect(DEFAULT_SURFACE_THEME).toBe("mono");
    expect(normalizeSurfaceTheme("ocean")).toBe("mono");
    expect(normalizeSurfaceTheme("neutral")).toBe("mono");
    expect(normalizeSurfaceTheme("deepsea")).toBe("mono");
    expect(normalizeSurfaceTheme("earth")).toBe("mono");
    expect(normalizeSurfaceTheme(undefined)).toBe("mono");
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

// @vitest-environment happy-dom

import fs from "node:fs";
import path from "node:path";
import chroma from "chroma-js";
import { describe, expect, it } from "vitest";

import {
  clearThemeColor,
  ENGINEERING_ACCENT,
  ENGINEERING_FOCUS,
  ENGINEERING_INK,
  getThemeColorTokens,
  migrateLegacyThemeAppearance,
  normalizeSurfaceTheme,
  normalizeThemeColor,
  normalizeThemeColorCookie,
  SURFACE_THEMES,
  SURFACE_THEME_COOKIE_KEY,
  SURFACE_THEME_STORAGE_KEY,
  THEME_COLOR_COOKIE_KEY,
  THEME_COLOR_STORAGE_KEY,
} from "./theme-surface";

function hslTokenToColor(value: string) {
  return chroma(`hsl(${value})`);
}

function createStorage(values: Record<string, string>) {
  const data = new Map(Object.entries(values));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
  };
}

describe("engineering theme surface", () => {
  it("pins the light engineering palette and 2px geometry in globals.css", () => {
    const css = fs.readFileSync(
      path.resolve(__dirname, "../app/globals.css"),
      "utf8",
    );

    expect(css).toContain("--background: 200 17.6% 96.7%");
    expect(css).toContain("--foreground: 204.4 37% 14.3%");
    expect(css).toContain("--border: 204 19% 84.5%");
    expect(css).toContain("--primary: 202.7 59% 31.6%");
    expect(css).toContain("--ring: 199.7 64.6% 38.8%");
    expect(css).toContain("--ink: 203.5 50.5% 19.8%");
    expect(css).toContain("--radius: 2px");
    expect(css).toContain("border-radius: var(--radius) !important");
    expect(css).toContain("--app-background-base: hsl(var(--background))");
    expect(css).toContain("--app-orb-primary-opacity: 0");
    expect(css).toContain("--app-orb-secondary-opacity: 0");
    expect(css).toContain("background-image: none");
  });

  it("pins the dark engineering palette and keeps the three colour roles distinct", () => {
    const css = fs.readFileSync(
      path.resolve(__dirname, "../app/globals.css"),
      "utf8",
    );

    expect(css).toContain("--background: 203.1 24.5% 10.4%");
    expect(css).toContain("--foreground: 200 20% 94.1%");
    expect(css).toContain("--border: 205 17.6% 26.7%");
    expect(css).toContain("--primary: 200 60% 73.5%");
    expect(css).toContain("--ring: 197.1 63.7% 66.5%");
    expect(css).toContain("--ink: 198.8 55.2% 77.3%");

    const tokens = getThemeColorTokens(ENGINEERING_ACCENT);
    expect(tokens?.["--primary"]).toBe("202.7 59% 31.6%");
    expect(tokens?.["--info"]).toBe("202.7 59% 31.6%");
    expect(tokens).not.toHaveProperty("--ring");
    expect(tokens).not.toHaveProperty("--focus");
    expect(tokens).not.toHaveProperty("--accent");
    expect(tokens).not.toHaveProperty("--ink");
  });

  it("keeps the accent token readable in both modes", () => {
    const tokens = getThemeColorTokens(ENGINEERING_ACCENT);
    expect(
      chroma.contrast(
        hslTokenToColor(tokens?.["--primary"] || ""),
        hslTokenToColor(tokens?.["--primary-foreground"] || ""),
      ),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("migrates legacy named surfaces to the single engineering appearance", () => {
    expect(SURFACE_THEMES).toHaveLength(1);
    expect(SURFACE_THEMES[0]).toMatchObject({
      key: "ocean",
      previewSurface: "#f5f7f8",
      defaultPrimary: ENGINEERING_ACCENT,
    });
    expect(normalizeSurfaceTheme("neutral")).toBe("ocean");
    expect(normalizeSurfaceTheme("deepsea")).toBe("ocean");
    expect(normalizeSurfaceTheme("earth")).toBe("ocean");
    expect(normalizeSurfaceTheme(undefined)).toBe("ocean");
  });

  it("accepts only the engineering accent and blocks focus/ink from taking its role", () => {
    expect(normalizeThemeColor("not-a-color")).toBeNull();
    expect(getThemeColorTokens("#e11d48")).toBeNull();
    expect(getThemeColorTokens(ENGINEERING_FOCUS)).toBeNull();
    expect(getThemeColorTokens(ENGINEERING_INK)).toBeNull();
  });

  it("clears legacy inline tokens, including old ring/accent values", () => {
    const root = document.createElement("html");
    root.style.setProperty("--primary", "199 89% 48%");
    root.style.setProperty("--ring", "199 89% 48%");
    root.style.setProperty("--focus", "199 89% 48%");
    root.style.setProperty("--accent", "225 80% 50%");
    root.style.setProperty("--ink", "225 80% 50%");

    clearThemeColor(root);

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

  it("keeps cookie parsing strict without letting legacy colours become tokens", () => {
    expect(normalizeThemeColorCookie("e11d48")).toBe("#e11d48");
    expect(normalizeThemeColorCookie("not-hex")).toBeNull();
    expect(
      getThemeColorTokens(normalizeThemeColorCookie("e11d48") || ""),
    ).toBeNull();
  });
});

import chroma, { type Color } from "chroma-js";
import { getClientStorage } from "./client-storage";

/**
 * Engineering appearance.
 *
 * The product now ships exactly one palette: engineering blue accents, a
 * single 2px geometry and light/dark modes. Named "surface themes" and
 * arbitrary accent colours are retained here only as migration inputs for
 * preferences written by older releases.
 */
export type SurfaceThemeKey = "ocean";

export const SURFACE_THEME_STORAGE_KEY = "mimirq.surfaceTheme";
export const THEME_COLOR_STORAGE_KEY = "mimirq.themeColor";
export const SURFACE_THEME_COOKIE_KEY = "mimirq_surface_theme";
export const THEME_COLOR_COOKIE_KEY = "mimirq_theme_color";
export const THEME_APPEARANCE_CHANGED_EVENT = "mimirq:theme-appearance-changed";

/** Engineering accent: links, selected states and current navigation. */
export const ENGINEERING_ACCENT = "#215c80";
/** Engineering focus ring: independent role, never derived from the accent. */
export const ENGINEERING_FOCUS = "#2379a3";
/** Engineering ink: primary-button surface, never used as a decorative accent. */
export const ENGINEERING_INK = "#19384c";

const LEGACY_SURFACE_THEMES = new Set([
  "ocean",
  "deepsea",
  "neutral",
  "classic",
  "earth",
]);

const THEME_COLOR_TOKEN_NAMES = [
  "--primary",
  "--ring",
  "--info",
  "--accent",
  "--accent-foreground",
  "--primary-foreground",
  "--primary-50",
  "--primary-100",
  "--primary-200",
  "--primary-300",
  "--primary-400",
  "--primary-500",
  "--primary-600",
  "--primary-700",
  "--primary-800",
  "--primary-900",
] as const;

/**
 * Only the accent role is overridable. Focus (`--ring`), selected surfaces
 * (`--accent`) and the primary-button ink (`--ink`) stay fixed so legacy
 * colour choices cannot collapse the three distinct roles.
 */
const ENGINEERING_ACCENT_TOKENS: Record<string, string> = {
  "--primary": "202.7 59% 31.6%",
  "--primary-foreground": "0 0% 100%",
  "--primary-50": "202.7 27.2% 95.9%",
  "--primary-100": "202.7 27.2% 90.4%",
  "--primary-200": "202.7 27.2% 80.8%",
  "--primary-300": "202.7 27.2% 68.5%",
  "--primary-400": "202.7 27.2% 52.1%",
  "--primary-500": "202.7 59% 31.6%",
  "--primary-600": "199.6 91.4% 23%",
  "--primary-700": "201.4 100% 18.5%",
  "--primary-800": "204.9 100% 15.1%",
  "--primary-900": "210 100% 11.8%",
  "--info": "202.7 59% 31.6%",
  "--info-foreground": "0 0% 100%",
};

type StorageReader = Pick<Storage, "getItem">;
type StorageWriter = Pick<Storage, "setItem" | "removeItem">;
type ThemeEventTarget = Pick<Window, "dispatchEvent">;
type ThemeCookieTarget = { cookie: string };

type ApplyThemeAppearanceOptions = {
  notify?: boolean;
};

export const SURFACE_THEMES: Array<{
  key: SurfaceThemeKey;
  label: string;
  description: string;
  previewSurface: string;
  defaultPrimary: string;
}> = [
  {
    key: "ocean",
    label: "Engineering",
    description: "工程蓝强调、hairline 结构与 2px 几何；唯一的正式外观。",
    previewSurface: "#f5f7f8",
    defaultPrimary: ENGINEERING_ACCENT,
  },
];

function isLegacySurfaceTheme(value: string): boolean {
  return LEGACY_SURFACE_THEMES.has(value);
}

/**
 * Old surface names are accepted and migrated to the single engineering
 * appearance. The function stays total so stale cookies cannot break SSR.
 */
export function normalizeSurfaceTheme(value?: string | null): SurfaceThemeKey {
  const raw = String(value || "")
    .trim()
    .toLowerCase();
  if (isLegacySurfaceTheme(raw)) return "ocean";
  return "ocean";
}

export function getSurfaceThemeMeta(theme: SurfaceThemeKey) {
  return SURFACE_THEMES.find((item) => item.key === theme) || SURFACE_THEMES[0];
}

export function readSurfaceTheme(
  storage?: StorageReader | null,
): SurfaceThemeKey {
  return normalizeSurfaceTheme(storage?.getItem(SURFACE_THEME_STORAGE_KEY));
}

export function applySurfaceTheme(
  theme: SurfaceThemeKey,
  root?: HTMLElement | null,
) {
  const target =
    root ?? (typeof document === "undefined" ? null : document.documentElement);
  if (!target) return;
  target.dataset.surfaceTheme = normalizeSurfaceTheme(theme);
}

function toHsl(color: Color): string {
  const [hue, saturation, lightness] = color.hsl();
  const safeHue = Number.isFinite(hue) ? hue : 0;

  return `${safeHue.toFixed(1)} ${(saturation * 100).toFixed(1)}% ${(lightness * 100).toFixed(1)}%`;
}

function getReadableForeground(color: Color): Color {
  return chroma.contrast(color, "white") >= 4.5
    ? chroma("white")
    : chroma("black");
}

export function readThemeColor(
  storage?: StorageReader | null,
  surfaceTheme: SurfaceThemeKey = "ocean",
): string {
  void storage;
  void surfaceTheme;
  return ENGINEERING_ACCENT;
}

export function normalizeThemeColor(value?: string | null): string | null {
  const candidate = String(value || "").trim();
  if (!candidate || !chroma.valid(candidate)) return null;
  return chroma(candidate).hex();
}

export function normalizeThemeColorCookie(
  value?: string | null,
): string | null {
  const candidate = String(value || "").trim();
  if (!/^[0-9a-f]{6}$/iu.test(candidate)) return null;
  return normalizeThemeColor(`#${candidate}`);
}

export function isEngineeringAccent(value?: string | null): boolean {
  return (
    normalizeThemeColor(value)?.toLowerCase() ===
    ENGINEERING_ACCENT.toLowerCase()
  );
}

/**
 * Returns the raw stored preference only when it is still the engineering
 * accent. Arbitrary legacy colours are reported as null so callers clear
 * their inline overrides instead of re-applying the old palette.
 */
export function readThemeColorOverride(
  storage?: StorageReader | null,
): string | null {
  const stored = normalizeThemeColor(storage?.getItem(THEME_COLOR_STORAGE_KEY));
  return stored && isEngineeringAccent(stored) ? stored : null;
}

/**
 * Accent tokens deliberately exclude `--ring`, `--accent` and `--ink`.
 * The focus ring, selected surface and primary-button ink are fixed roles.
 */
export function getThemeColorTokens(
  color: string,
): Record<string, string> | null {
  if (!isEngineeringAccent(color)) return null;
  return { ...ENGINEERING_ACCENT_TOKENS };
}

export function applyThemeColor(color: string, root?: HTMLElement | null) {
  const target =
    root ?? (typeof document === "undefined" ? null : document.documentElement);
  const tokens = getThemeColorTokens(color);
  if (!target || !tokens) return;

  for (const [token, value] of Object.entries(tokens)) {
    target.style.setProperty(token, value);
  }
}

/** Removes both current and legacy inline tokens, including old ring/accent values. */
export function clearThemeColor(root?: HTMLElement | null) {
  const target =
    root ?? (typeof document === "undefined" ? null : document.documentElement);
  if (!target) return;

  for (const token of THEME_COLOR_TOKEN_NAMES) {
    target.style.removeProperty(token);
  }
}

export function persistThemeAppearance(
  theme: SurfaceThemeKey,
  colorOverride: string | null,
  storage: StorageWriter | null = getClientStorage(),
  cookieTarget: ThemeCookieTarget | null = globalThis.document ?? null,
) {
  const surfaceTheme = normalizeSurfaceTheme(theme);
  const normalizedColor = isEngineeringAccent(colorOverride)
    ? ENGINEERING_ACCENT
    : null;

  try {
    storage?.setItem(SURFACE_THEME_STORAGE_KEY, surfaceTheme);
    if (normalizedColor)
      storage?.setItem(THEME_COLOR_STORAGE_KEY, normalizedColor);
    else storage?.removeItem(THEME_COLOR_STORAGE_KEY);
  } catch {
    // Storage can be unavailable in private or policy-restricted browser contexts.
  }

  if (cookieTarget) {
    const commonAttributes = "Path=/; Max-Age=31536000; SameSite=Lax";
    cookieTarget.cookie = `${SURFACE_THEME_COOKIE_KEY}=${surfaceTheme}; ${commonAttributes}`;
    cookieTarget.cookie = normalizedColor
      ? `${THEME_COLOR_COOKIE_KEY}=${normalizedColor.slice(1)}; ${commonAttributes}`
      : `${THEME_COLOR_COOKIE_KEY}=; Path=/; Max-Age=0; SameSite=Lax`;
  }

  return { surfaceTheme, colorOverride: normalizedColor };
}

export function notifyThemeAppearanceChanged(
  eventTarget: ThemeEventTarget | null = globalThis.window ?? null,
) {
  const target = eventTarget;
  if (!target) return;

  const event =
    typeof CustomEvent === "function"
      ? new CustomEvent(THEME_APPEARANCE_CHANGED_EVENT)
      : new Event(THEME_APPEARANCE_CHANGED_EVENT);
  target.dispatchEvent(event);
}

/**
 * Drops all pre-engineering appearance preferences: named surface themes,
 * arbitrary accent colours and any inline token they left on the root.
 * Light/dark/system mode is owned by next-themes and is left untouched.
 */
export function migrateLegacyThemeAppearance(
  storage: StorageWriter | null = getClientStorage(),
  root?: HTMLElement | null,
  cookieTarget: ThemeCookieTarget | null = globalThis.document ?? null,
) {
  try {
    storage?.removeItem(SURFACE_THEME_STORAGE_KEY);
    storage?.removeItem(THEME_COLOR_STORAGE_KEY);
  } catch {
    // Storage can be unavailable in private or policy-restricted browser contexts.
  }

  if (cookieTarget) {
    const expired = "Path=/; Max-Age=0; SameSite=Lax";
    cookieTarget.cookie = `${SURFACE_THEME_COOKIE_KEY}=; ${expired}`;
    cookieTarget.cookie = `${THEME_COLOR_COOKIE_KEY}=; ${expired}`;
  }

  const target =
    root ?? (typeof document === "undefined" ? null : document.documentElement);
  if (target) {
    clearThemeColor(target);
    delete target.dataset.surfaceTheme;
  }
}

/**
 * Applies the engineering defaults. Kept for callers that used to apply the
 * stored palette during hydration; it now always clears legacy overrides.
 */
export function applyStoredThemeAppearance(
  storage: StorageReader | null = getClientStorage(),
  root?: HTMLElement | null,
  eventTarget?: ThemeEventTarget | null,
  options: ApplyThemeAppearanceOptions = {},
) {
  void storage;

  const target =
    root ?? (typeof document === "undefined" ? null : document.documentElement);
  if (target) {
    target.dataset.surfaceTheme = "ocean";
    clearThemeColor(target);
  }

  if (options.notify !== false) {
    notifyThemeAppearanceChanged(eventTarget);
  }

  return {
    surfaceTheme: "ocean" as const,
    color: ENGINEERING_ACCENT,
    colorOverride: null,
  };
}

import chroma from "chroma-js";
import { getClientStorage } from "./client-storage";

/**
 * Engineering appearance.
 *
 * The product ships exactly one palette: engineering blue accents, a single
 * 2px geometry and light/dark modes. Named surface themes and arbitrary accent
 * colours remain only as migration inputs for preferences written by older
 * releases.
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

const THEME_COLOR_TOKEN_NAMES = [
  "--primary",
  "--ring",
  "--focus",
  "--info",
  "--ink",
  "--ink-foreground",
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
 * Only the accent role is representable. Focus (`--ring`/`--focus`), selected
 * surfaces (`--accent`) and primary-button ink (`--ink`) are never derived from
 * this override, so legacy colour choices cannot collapse the three roles.
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

type StorageWriter = Pick<Storage, "setItem" | "removeItem">;
type ThemeCookieTarget = { cookie: string };

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

/** Old surface names are accepted and migrated to the engineering appearance. */
export function normalizeSurfaceTheme(value?: string | null): SurfaceThemeKey {
  void value;
  return "ocean";
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
 * Accent tokens deliberately exclude `--ring`/`--focus`, `--accent` and
 * `--ink`; the focus ring, selected surface and primary-button ink stay fixed.
 */
export function getThemeColorTokens(
  color: string,
): Record<string, string> | null {
  if (!isEngineeringAccent(color)) return null;
  return { ...ENGINEERING_ACCENT_TOKENS };
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

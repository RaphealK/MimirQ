import { getClientStorage } from "./client-storage";

/**
 * Monochrome appearance.
 *
 * The product ships exactly one surface palette: black/white/grey with
 * success/warning/danger reserved for status meaning. Named surface themes
 * and arbitrary accent colours exist only as migration inputs from older
 * releases; they are removed, never translated back into colour tokens.
 */
export type SurfaceThemeKey = "mono";

export const DEFAULT_SURFACE_THEME: SurfaceThemeKey = "mono";

export const SURFACE_THEME_STORAGE_KEY = "mimirq.surfaceTheme";
export const THEME_COLOR_STORAGE_KEY = "mimirq.themeColor";
export const SURFACE_THEME_COOKIE_KEY = "mimirq_surface_theme";
export const THEME_COLOR_COOKIE_KEY = "mimirq_theme_color";
export const THEME_APPEARANCE_CHANGED_EVENT = "mimirq:theme-appearance-changed";

/**
 * Inline tokens older releases could write on `<html>`. They are cleared so a
 * stored blue accent can never override the monochrome palette.
 */
const LEGACY_INLINE_TOKEN_NAMES = [
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

type StorageWriter = Pick<Storage, "setItem" | "removeItem">;
type ThemeCookieTarget = { cookie: string };

/**
 * Every historic surface name resolves to the single monochrome appearance,
 * including the old "ocean" default. The stored value is never applied as a
 * palette selector.
 */
export function normalizeSurfaceTheme(_value?: string | null): SurfaceThemeKey {
  return DEFAULT_SURFACE_THEME;
}

/** Removes legacy inline tokens, including old ring/accent values. */
export function clearLegacyInlineTokens(root?: HTMLElement | null) {
  const target =
    root ?? (typeof document === "undefined" ? null : document.documentElement);
  if (!target) return;

  for (const token of LEGACY_INLINE_TOKEN_NAMES) {
    target.style.removeProperty(token);
  }
}

/**
 * Drops all pre-monochrome appearance preferences: named surface themes,
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
    clearLegacyInlineTokens(target);
    delete target.dataset.surfaceTheme;
  }
}

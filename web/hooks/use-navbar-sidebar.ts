"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useMediaQuery } from "@/hooks/use-media-query";
import { readClientStorage, writeClientStorage } from "@/lib/client-storage";

/**
 * 侧栏断点（与 Tailwind 保持一致）：
 * - mobile:  < 768px，遮罩抽屉
 * - tablet:  768–1023px，默认 64px 图标栏
 * - desktop: >= 1024px，默认 224px
 */
export type NavbarBreakpoint = "mobile" | "tablet" | "desktop";

/** 桌面端显式偏好；只有 >= 1024px 的手动切换会持久化。 */
export type NavbarDesktopPreference = "expanded" | "collapsed";

export const NAVBAR_SIDEBAR_STORAGE_KEY = "mimirq_navbar_sidebar";
export const NAVBAR_SIDEBAR_TABLET_STORAGE_KEY = "mimirq_navbar_sidebar:tablet";
export const NAVBAR_SIDEBAR_EXPANDED = "expanded";
export const NAVBAR_SIDEBAR_COLLAPSED = "collapsed";

export type NavbarSidebarController = {
  breakpoint: NavbarBreakpoint;
  /** 窄屏遮罩抽屉模式。 */
  isOverlay: boolean;
  isDrawerOpen: boolean;
  /** 非窄屏下的 224px 展开态。 */
  isExpanded: boolean;
  /** 非窄屏下的 64px 图标态。 */
  isCollapsed: boolean;
  /** 侧栏当前是否可见（窄屏看抽屉是否打开；宽屏恒为 true）。 */
  isVisible: boolean;
  toggle: () => void;
  closeDrawer: () => void;
};

function storageKeyForBreakpoint(
  breakpoint: Exclude<NavbarBreakpoint, "mobile">,
): string {
  return breakpoint === "tablet"
    ? NAVBAR_SIDEBAR_TABLET_STORAGE_KEY
    : NAVBAR_SIDEBAR_STORAGE_KEY;
}

function readBreakpointPreference(
  breakpoint: Exclude<NavbarBreakpoint, "mobile">,
): boolean | null {
  const raw = readClientStorage(storageKeyForBreakpoint(breakpoint));
  if (raw === NAVBAR_SIDEBAR_EXPANDED) return true;
  if (raw === NAVBAR_SIDEBAR_COLLAPSED) return false;
  return null;
}

/**
 * `useMediaQuery` deliberately returns the server snapshot during hydration.
 * Resolve the real viewport once effects run so the first post-mount state change
 * cannot mistake a desktop viewport for the tablet default and collapse the rail.
 */
function resolveViewportBreakpoint(
  fallback: NavbarBreakpoint,
): NavbarBreakpoint {
  if (globalThis.window === undefined) return fallback;
  try {
    if (globalThis.window.matchMedia("(max-width: 767.98px)").matches) {
      return "mobile";
    }
    if (globalThis.window.matchMedia("(min-width: 1024px)").matches) {
      return "desktop";
    }
    return "tablet";
  } catch {
    return fallback;
  }
}

export function useNavbarSidebar(enabled = true): NavbarSidebarController {
  const isMobile = useMediaQuery("(max-width: 767.98px)");
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const breakpoint: NavbarBreakpoint = isMobile
    ? "mobile"
    : isDesktop
      ? "desktop"
      : "tablet";

  // SSR 首帧与客户端 hydrate 首帧保持一致（默认展开），挂载后再按断点收敛。
  const [isExpanded, setIsExpanded] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const previousBreakpointRef = useRef<NavbarBreakpoint | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const resolvedBreakpoint = resolveViewportBreakpoint(breakpoint);
    if (previousBreakpointRef.current === resolvedBreakpoint) return;
    previousBreakpointRef.current = resolvedBreakpoint;

    if (resolvedBreakpoint === "mobile") {
      // 遮罩抽屉永远不因桌面偏好自动撑开。
      setIsDrawerOpen(false);
      return;
    }

    // Rotating out of the drawer breakpoint must drop the modal state so the
    // body scroll lock is released with it.
    setIsDrawerOpen(false);

    if (resolvedBreakpoint === "desktop") {
      setIsExpanded(readBreakpointPreference("desktop") ?? true);
      return;
    }

    // 768–1023px：默认收起，但显式偏好独立持久化。
    setIsExpanded(readBreakpointPreference("tablet") ?? false);
  }, [breakpoint, enabled]);

  const toggle = useCallback(() => {
    if (!enabled) return;

    const resolvedBreakpoint = resolveViewportBreakpoint(breakpoint);
    if (resolvedBreakpoint === "mobile") {
      setIsDrawerOpen((open) => !open);
      return;
    }

    const nextExpanded = !isExpanded;
    setIsExpanded(nextExpanded);
    writeClientStorage(
      storageKeyForBreakpoint(resolvedBreakpoint),
      nextExpanded ? NAVBAR_SIDEBAR_EXPANDED : NAVBAR_SIDEBAR_COLLAPSED,
    );
  }, [breakpoint, enabled, isExpanded]);

  const closeDrawer = useCallback(() => {
    setIsDrawerOpen(false);
  }, []);

  const isOverlay = breakpoint === "mobile";

  // Lock the document only while the modal drawer is open. The app already
  // scrolls inside panels, so this only stops accidental page-level scrolling
  // and is released on close, unmount, or an orientation/breakpoint change.
  useEffect(() => {
    if (!enabled || !isOverlay || !isDrawerOpen) return;
    if (globalThis.document === undefined) return;

    const body = globalThis.document.body;
    const previousOverflow = body.style.overflow;
    const previousOverscrollBehavior = body.style.overscrollBehavior;
    body.dataset.navbarDrawerOpen = "true";
    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "contain";

    return () => {
      delete body.dataset.navbarDrawerOpen;
      body.style.overflow = previousOverflow;
      body.style.overscrollBehavior = previousOverscrollBehavior;
    };
  }, [enabled, isDrawerOpen, isOverlay]);

  const isVisible = !isOverlay || isDrawerOpen;

  return {
    breakpoint,
    isOverlay,
    isDrawerOpen,
    isExpanded,
    isCollapsed: !isOverlay && !isExpanded,
    isVisible,
    toggle,
    closeDrawer,
  };
}

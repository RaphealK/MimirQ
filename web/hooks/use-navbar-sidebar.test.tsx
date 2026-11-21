// @vitest-environment happy-dom

import React, { act, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  NAVBAR_SIDEBAR_STORAGE_KEY,
  NAVBAR_SIDEBAR_TABLET_STORAGE_KEY,
  useNavbarSidebar,
  type NavbarSidebarController,
} from "./use-navbar-sidebar";

type MediaListener = () => void;

let currentWidth = 1440;
const listenersByQuery = new Map<string, Set<MediaListener>>();

function queryMatches(query: string, width: number): boolean {
  if (query.includes("max-width: 767.98px")) return width < 768;
  if (query.includes("min-width: 1024px")) return width >= 1024;
  return false;
}

function listenersFor(query: string): Set<MediaListener> {
  const existing = listenersByQuery.get(query);
  if (existing) return existing;
  const created = new Set<MediaListener>();
  listenersByQuery.set(query, created);
  return created;
}

function installMatchMedia() {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn((query: string) => ({
      get matches() {
        return queryMatches(query, currentWidth);
      },
      media: query,
      onchange: null,
      addEventListener: (_type: string, listener: MediaListener) => {
        listenersFor(query).add(listener);
      },
      removeEventListener: (_type: string, listener: MediaListener) => {
        listenersFor(query).delete(listener);
      },
      addListener: (listener: MediaListener) => {
        listenersFor(query).add(listener);
      },
      removeListener: (listener: MediaListener) => {
        listenersFor(query).delete(listener);
      },
      dispatchEvent: () => true,
    })),
  });
}

function setViewport(width: number) {
  const previousWidth = currentWidth;
  currentWidth = width;
  for (const [query, listeners] of listenersByQuery) {
    if (queryMatches(query, previousWidth) === queryMatches(query, width)) {
      continue;
    }
    for (const listener of Array.from(listeners)) listener();
  }
}

let controller: NavbarSidebarController;

function SidebarHarness({ enabled = true }: { enabled?: boolean }) {
  const sidebar = useNavbarSidebar(enabled);

  useEffect(() => {
    controller = sidebar;
  }, [sidebar]);

  return (
    <div data-testid="sidebar-state" data-breakpoint={sidebar.breakpoint} />
  );
}

function renderSidebar(width: number, enabled = true) {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;

  currentWidth = width;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(<SidebarHarness enabled={enabled} />);
  });

  return {
    container,
    unmount() {
      act(() => root.unmount());
      container.remove();
    },
  };
}

describe("useNavbarSidebar", () => {
  beforeEach(() => {
    window.localStorage.clear();
    listenersByQuery.clear();
    currentWidth = 1440;
    installMatchMedia();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.replaceChildren();
  });

  it("defaults to a 224px expanded rail on desktop", () => {
    const view = renderSidebar(1440);

    expect(controller.breakpoint).toBe("desktop");
    expect(controller.isExpanded).toBe(true);
    expect(controller.isCollapsed).toBe(false);
    expect(controller.isVisible).toBe(true);

    view.unmount();
  });

  it("defaults to a 64px collapsed rail on tablet", () => {
    const view = renderSidebar(900);

    expect(controller.breakpoint).toBe("tablet");
    expect(controller.isExpanded).toBe(false);
    expect(controller.isCollapsed).toBe(true);
    expect(controller.isVisible).toBe(true);

    view.unmount();
  });

  it("persists an explicit desktop preference across remounts", () => {
    const firstView = renderSidebar(1440);

    act(() => {
      controller.toggle();
    });

    expect(controller.isExpanded).toBe(false);
    expect(window.localStorage.getItem(NAVBAR_SIDEBAR_STORAGE_KEY)).toBe(
      "collapsed",
    );
    firstView.unmount();

    const secondView = renderSidebar(1440);
    expect(controller.isExpanded).toBe(false);
    expect(controller.isCollapsed).toBe(true);
    secondView.unmount();
  });

  it("persists tablet preferences under a separate key", () => {
    const firstView = renderSidebar(900);

    act(() => {
      controller.toggle();
    });

    expect(controller.isExpanded).toBe(true);
    expect(window.localStorage.getItem(NAVBAR_SIDEBAR_TABLET_STORAGE_KEY)).toBe(
      "expanded",
    );
    expect(window.localStorage.getItem(NAVBAR_SIDEBAR_STORAGE_KEY)).toBeNull();
    firstView.unmount();

    const secondView = renderSidebar(900);
    expect(controller.isExpanded).toBe(true);
    expect(controller.isCollapsed).toBe(false);
    secondView.unmount();
  });

  it("keeps desktop and tablet preferences independent", () => {
    const view = renderSidebar(1440);

    act(() => {
      controller.toggle();
    });
    expect(window.localStorage.getItem(NAVBAR_SIDEBAR_STORAGE_KEY)).toBe(
      "collapsed",
    );

    act(() => setViewport(900));
    expect(controller.isExpanded).toBe(false);

    act(() => {
      controller.toggle();
    });
    expect(window.localStorage.getItem(NAVBAR_SIDEBAR_TABLET_STORAGE_KEY)).toBe(
      "expanded",
    );

    act(() => setViewport(1440));
    expect(controller.isExpanded).toBe(false);

    act(() => setViewport(900));
    expect(controller.isExpanded).toBe(true);

    view.unmount();
  });

  it("never opens the mobile drawer from a stored desktop preference", () => {
    window.localStorage.setItem(NAVBAR_SIDEBAR_STORAGE_KEY, "expanded");
    window.localStorage.setItem(NAVBAR_SIDEBAR_TABLET_STORAGE_KEY, "expanded");
    const view = renderSidebar(390);

    expect(controller.breakpoint).toBe("mobile");
    expect(controller.isOverlay).toBe(true);
    expect(controller.isDrawerOpen).toBe(false);
    expect(controller.isVisible).toBe(false);

    act(() => {
      controller.toggle();
    });

    expect(controller.isDrawerOpen).toBe(true);
    expect(controller.isVisible).toBe(true);
    expect(window.localStorage.getItem(NAVBAR_SIDEBAR_STORAGE_KEY)).toBe(
      "expanded",
    );
    expect(window.localStorage.getItem(NAVBAR_SIDEBAR_TABLET_STORAGE_KEY)).toBe(
      "expanded",
    );

    view.unmount();
  });

  it("locks body scrolling only while the mobile drawer is open and releases it across breakpoints", () => {
    const view = renderSidebar(390);

    expect(document.body.dataset.navbarDrawerOpen).toBeUndefined();

    act(() => {
      controller.toggle();
    });

    expect(document.body.dataset.navbarDrawerOpen).toBe("true");
    expect(document.body.style.overflow).toBe("hidden");
    expect(document.body.style.overscrollBehavior).toBe("contain");

    // Rotating to the 768–1023px rail must not leave the document locked.
    act(() => setViewport(900));

    expect(controller.isOverlay).toBe(false);
    expect(controller.isDrawerOpen).toBe(false);
    expect(document.body.dataset.navbarDrawerOpen).toBeUndefined();
    expect(document.body.style.overflow).toBe("");
    expect(document.body.style.overscrollBehavior).toBe("");

    view.unmount();
  });

  it("reapplies breakpoint defaults when crossing breakpoints", () => {
    const view = renderSidebar(1440);

    act(() => {
      controller.toggle();
    });
    expect(controller.isExpanded).toBe(false);

    act(() => setViewport(900));
    expect(controller.breakpoint).toBe("tablet");
    expect(controller.isExpanded).toBe(false);

    act(() => {
      controller.toggle();
    });
    expect(controller.isExpanded).toBe(true);

    act(() => setViewport(1440));
    expect(controller.breakpoint).toBe("desktop");
    expect(controller.isExpanded).toBe(false);

    view.unmount();
  });
});

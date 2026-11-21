// @vitest-environment happy-dom

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/components/navbar", () => ({
  Navbar: ({
    sidebar,
  }: {
    sidebar: {
      isOverlay: boolean;
      isDrawerOpen: boolean;
      isExpanded: boolean;
      isVisible: boolean;
      toggle: () => void;
    };
  }) => (
    <div
      data-testid="navbar"
      data-state={
        sidebar.isOverlay
          ? sidebar.isDrawerOpen
            ? "overlay-open"
            : "overlay-closed"
          : sidebar.isExpanded
            ? "expanded"
            : "collapsed"
      }
      data-open={String(sidebar.isVisible)}
    >
      <button
        type="button"
        data-testid="navbar-toggle"
        onClick={sidebar.toggle}
      >
        toggle
      </button>
    </div>
  ),
}));

vi.mock("@/components/app-frame-topbar", () => ({
  AppFrameTopbar: () => <header data-testid="app-frame-topbar" />,
}));

vi.mock("@/components/ui/app-background", () => ({
  AppBackground: () => null,
}));

vi.mock("@/store/document-view", () => ({
  useDocumentView: () => ({ isOpen: false }),
}));

import { AppFrame } from "./app-frame";

type Viewport = "mobile" | "tablet" | "desktop";

function installMatchMedia(viewport: Viewport) {
  const matchesFor = (query: string) => {
    if (query.includes("max-width: 767.98px")) return viewport === "mobile";
    if (query.includes("min-width: 1024px")) return viewport === "desktop";
    return false;
  };

  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn((query: string) => ({
      matches: matchesFor(query),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(() => true),
    })),
  });
}

function renderFrame(viewport: Viewport) {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;

  installMatchMedia(viewport);

  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(<AppFrame>content</AppFrame>);
  });

  return {
    container,
    unmount() {
      act(() => root.unmount());
      container.remove();
    },
  };
}

describe("AppFrame responsive sidebar", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.replaceChildren();
  });

  it("starts with page content available on mobile", () => {
    const view = renderFrame("mobile");

    expect(
      view.container
        .querySelector('[data-testid="navbar"]')
        ?.getAttribute("data-state"),
    ).toBe("overlay-closed");
    expect(
      view.container
        .querySelector("#main-content")
        ?.closest('[aria-hidden="true"]'),
    ).toBeNull();

    view.unmount();
  });

  it("preserves the desktop 224px default", () => {
    const view = renderFrame("desktop");

    expect(
      view.container
        .querySelector('[data-testid="navbar"]')
        ?.getAttribute("data-state"),
    ).toBe("expanded");

    view.unmount();
  });

  it("defaults to the 64px icon rail on tablet", () => {
    const view = renderFrame("tablet");

    expect(
      view.container
        .querySelector('[data-testid="navbar"]')
        ?.getAttribute("data-state"),
    ).toBe("collapsed");
    expect(
      view.container
        .querySelector('[data-testid="navbar"]')
        ?.getAttribute("data-open"),
    ).toBe("true");

    view.unmount();
  });

  it("makes the page inert only while the mobile drawer is open", () => {
    const view = renderFrame("mobile");
    const toggle = view.container.querySelector(
      '[data-testid="navbar-toggle"]',
    ) as HTMLButtonElement | null;

    act(() => {
      toggle?.click();
    });

    expect(
      view.container
        .querySelector('[data-testid="navbar"]')
        ?.getAttribute("data-state"),
    ).toBe("overlay-open");
    expect(
      view.container
        .querySelector("#main-content")
        ?.closest('[aria-hidden="true"]'),
    ).not.toBeNull();

    act(() => {
      toggle?.click();
    });

    expect(
      view.container
        .querySelector("#main-content")
        ?.closest('[aria-hidden="true"]'),
    ).toBeNull();

    view.unmount();
  });
});

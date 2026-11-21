// @vitest-environment happy-dom

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const commandMenuStore = vi.hoisted(() => ({
  open: false,
  setOpen: vi.fn(),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({
    children,
    href,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) =>
    React.createElement("a", { href, ...props }, children),
  usePathname: () => "/knowledge",
}));

vi.mock("@/components/navbar", () => ({
  getNavigationBreadcrumb: () => ({
    sectionTitleKey: "sections.knowledge",
    itemLabelKey: "items.knowledgeBase",
  }),
}));

vi.mock("@/store/command-menu", () => ({
  useCommandMenuState: (
    selector: (state: typeof commandMenuStore) => unknown,
  ) => selector(commandMenuStore),
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ isDevMode: false }),
}));

vi.mock("@/hooks/use-backend-meta", () => ({
  useBackendMetaDetails: () => ({ data: null }),
}));

vi.mock("@/hooks/use-backend-ready", () => ({
  useBackendReady: () => ({
    data: null,
    dataUpdatedAt: 0,
    errorUpdatedAt: 0,
    isError: false,
  }),
}));

vi.mock("@/hooks/use-tenant-access", () => ({
  useTenantAccess: () => ({ data: { permissions: [] } }),
}));

vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
  PopoverContent: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children),
  PopoverTrigger: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
}));

vi.mock("@/components/ui/status-badge", () => ({
  StatusBadge: ({ label }: { label: string }) =>
    React.createElement("span", null, label),
}));

import type { NavbarSidebarController } from "@/hooks/use-navbar-sidebar";

import { AppFrameTopbar } from "./app-frame-topbar";

function createSidebar(
  overrides: Partial<NavbarSidebarController> = {},
): NavbarSidebarController {
  return {
    breakpoint: "desktop",
    isOverlay: false,
    isDrawerOpen: false,
    isExpanded: true,
    isCollapsed: false,
    isVisible: true,
    toggle: vi.fn(),
    closeDrawer: vi.fn(),
    ...overrides,
  };
}

function renderTopbar(sidebar = createSidebar()) {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;

  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(React.createElement(AppFrameTopbar, { sidebar }));
  });

  return {
    container,
    rerender(nextSidebar: NavbarSidebarController) {
      act(() => {
        root.render(
          React.createElement(AppFrameTopbar, { sidebar: nextSidebar }),
        );
      });
    },
    unmount() {
      act(() => root.unmount());
      container.remove();
    },
  };
}

describe("AppFrameTopbar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    commandMenuStore.open = false;
    commandMenuStore.setOpen = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.replaceChildren();
  });

  it("renders the current location and opens the existing command menu", () => {
    const view = renderTopbar();

    expect(view.container.textContent).toContain("sections.knowledge");
    expect(view.container.textContent).toContain("items.knowledgeBase");

    const search = view.container.querySelector(
      'button[aria-controls="mimirq-command-menu"]',
    ) as HTMLButtonElement | null;
    expect(search).not.toBeNull();

    act(() => {
      search?.click();
    });
    expect(commandMenuStore.setOpen).toHaveBeenCalledWith(true);

    view.unmount();
  });

  it("keeps a 48px topbar with 44px touch controls", () => {
    const view = renderTopbar();
    const header = view.container.querySelector("header");
    const search = view.container.querySelector(
      'button[aria-controls="mimirq-command-menu"]',
    );

    expect(header?.className).toContain("h-12");
    expect(search?.className).toContain("h-11");
    expect(search?.className).toContain("w-11");

    view.unmount();
  });

  it("exposes the single sidebar toggle with aria-controls/expanded", () => {
    const sidebar = createSidebar();
    const view = renderTopbar(sidebar);
    const toggle = view.container.querySelector(
      '[data-navbar-toggle="true"]',
    ) as HTMLButtonElement | null;

    expect(toggle?.getAttribute("aria-controls")).toBe("mimirq-sidebar");
    expect(toggle?.getAttribute("aria-expanded")).toBe("true");
    expect(toggle?.getAttribute("aria-label")).toBe("toolbar.collapse");
    expect(toggle?.className).toContain("size-11");

    act(() => {
      toggle?.click();
    });
    expect(sidebar.toggle).toHaveBeenCalledTimes(1);

    view.unmount();
  });

  it("announces a collapsed rail as not expanded", () => {
    const view = renderTopbar(
      createSidebar({ isExpanded: false, isCollapsed: true, isVisible: false }),
    );
    const toggle = view.container.querySelector('[data-navbar-toggle="true"]');

    expect(toggle?.getAttribute("aria-expanded")).toBe("false");
    expect(toggle?.getAttribute("aria-label")).toBe("toolbar.expand");

    view.unmount();
  });

  it("uses the drawer state for aria-expanded in overlay mode", () => {
    const view = renderTopbar(
      createSidebar({
        breakpoint: "mobile",
        isOverlay: true,
        isDrawerOpen: true,
        isExpanded: false,
        isVisible: true,
      }),
    );
    const toggle = view.container.querySelector('[data-navbar-toggle="true"]');

    expect(toggle?.getAttribute("data-navbar-toggle-mode")).toBe("overlay");
    expect(toggle?.getAttribute("aria-expanded")).toBe("true");
    expect(toggle?.getAttribute("aria-label")).toBe("toolbar.collapse");

    view.unmount();
  });

  it("keeps focus on the same toggle while its icon and label change", () => {
    const view = renderTopbar(createSidebar());
    const toggle = view.container.querySelector(
      '[data-navbar-toggle="true"]',
    ) as HTMLButtonElement | null;

    act(() => {
      toggle?.focus();
    });
    expect(document.activeElement).toBe(toggle);

    act(() => {
      view.rerender(
        createSidebar({
          isExpanded: false,
          isCollapsed: true,
          isVisible: false,
        }),
      );
    });

    const collapsedToggle = view.container.querySelector(
      '[data-navbar-toggle="true"]',
    );
    expect(collapsedToggle).toBe(toggle);
    expect(document.activeElement).toBe(toggle);
    expect(collapsedToggle?.getAttribute("aria-expanded")).toBe("false");
    expect(collapsedToggle?.querySelector("svg")).not.toBeNull();

    act(() => {
      view.rerender(createSidebar());
    });
    expect(document.activeElement).toBe(toggle);

    view.unmount();
  });
});

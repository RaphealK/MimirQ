// @vitest-environment happy-dom

import React, { act } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import chatMessages from "@/i18n/messages/zh-CN/chat";

const routerMocks = vi.hoisted(() => ({
  pathname: "/knowledge/similarity",
  prefetch: vi.fn(),
  push: vi.fn(),
}));

const commandMenuStore = vi.hoisted(() => ({
  open: false,
  setOpen: vi.fn(),
}));

const adminTenantAccess = {
  account_id: "test-account",
  is_active: true,
  is_current: true,
  permissions: [
    "settings.read",
    "settings.write",
    "observability.read",
    "usage.read",
    "audit.read",
    "audit.manage",
    "table_sql.read",
    "lifecycle.manage",
  ],
  role: "admin",
  tenant_id: "test-tenant",
};

const tenantAccessMock = vi.hoisted(() => ({
  current: {
    data: undefined as unknown,
  },
}));

const messages: Record<
  string,
  string | ((values?: Record<string, unknown>) => string)
> = {
  "actions.newConversation": "actions.newConversation",
  "auth.goToLogin": "auth.goToLogin",
  "auth.login": "auth.login",
  "brand.tagline": "brand.tagline",
  "command.triggerHint": "command.triggerHint",
  "command.triggerLabel": "command.triggerLabel",
  "deps.openStatus": "deps.openStatus",
  "deps.ready": "deps.ready",
  "deps.unavailable": "deps.unavailable",
  "items.datasets": chatMessages.Navbar.items.datasets,
  "items.ragVisualization": "items.ragVisualization",
  "items.knowledgeBase": chatMessages.Navbar.items.knowledgeBase,
  "sections.analysis": "sections.analysis",
  "sections.core": "sections.core",
  "sections.current": "sections.current",
  "sections.entryCount": (values) => `count:${String(values?.count ?? "")}`,
  "sections.ingestion": "sections.ingestion",
  "sections.knowledge": "sections.knowledge",
  "sections.system": "sections.system",
  "status.badgePrefix": "status.badgePrefix:",
  "toolbar.navLabel": "toolbar.navLabel",
  "toolbar.appearance": "界面外观",
  "toolbar.sidebarClose": "toolbar.sidebarClose",
  "user.offlineEnvironment": "user.offlineEnvironment",
  "user.openSettings": "user.openSettings",
  "user.unauthenticatedName": "user.unauthenticatedName",
};

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) => {
    const value = messages[key];
    if (typeof value === "function") return value(values);
    return value ?? key;
  },
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({
    children,
    href,
    prefetch: _prefetch,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    prefetch?: boolean;
  }) => React.createElement("a", { href, ...props }, children),
  usePathname: () => routerMocks.pathname,
  useRouter: () => ({
    prefetch: routerMocks.prefetch,
    push: routerMocks.push,
  }),
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    isAuthenticated: false,
    isDevMode: true,
    logout: vi.fn(),
    user: null,
  }),
}));

vi.mock("@/hooks/use-backend-meta", () => ({
  useBackendMetaDetails: () => ({
    data: null,
  }),
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
  useTenantAccess: () => tenantAccessMock.current,
}));

vi.mock("@/store/command-menu", () => ({
  useCommandMenuState: (
    selector: (state: typeof commandMenuStore) => unknown,
  ) => selector(commandMenuStore),
}));

vi.mock("@/components/mode-toggle", () => ({
  ModeToggle: () =>
    React.createElement("div", { "data-testid": "mode-toggle" }),
}));

vi.mock("@/components/ui/status-badge", () => ({
  StatusBadge: ({ label }: { label: string }) =>
    React.createElement("div", null, label),
}));

vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
  PopoverContent: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children),
  PopoverTrigger: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
}));

import type { NavbarSidebarController } from "@/hooks/use-navbar-sidebar";

import { Navbar } from "./navbar";

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

function renderComponent(element: React.ReactElement) {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;

  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(element);
  });

  return {
    container,
    rerender(element: React.ReactElement) {
      act(() => {
        root.render(element);
      });
    },
    unmount() {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

describe("Navbar behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routerMocks.pathname = "/knowledge/similarity";
    commandMenuStore.open = false;
    commandMenuStore.setOpen = vi.fn();
    tenantAccessMock.current = { data: adminTenantAccess };
    window.localStorage.clear();
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        addEventListener: vi.fn(),
        addListener: vi.fn(),
        dispatchEvent: vi.fn(),
        matches: false,
        media: query,
        onchange: null,
        removeEventListener: vi.fn(),
        removeListener: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps the advanced similarity route out of the primary sidebar", () => {
    const view = renderComponent(
      React.createElement(Navbar, { sidebar: createSidebar() }),
    );

    const knowledgeSection = view.container.querySelector(
      'button[aria-controls="sidebar-section-knowledge"]',
    );
    const analysisSection = view.container.querySelector(
      'button[aria-controls="sidebar-section-analysis"]',
    );
    const knowledgeBaseLink = view.container.querySelector(
      'a[href="/knowledge"]',
    );
    const evaluationsLink = Array.from(
      view.container.querySelectorAll("a"),
    ).find((node) => node.textContent?.includes("items.ragas"));
    const ragVisualizationLink = Array.from(
      view.container.querySelectorAll("a"),
    ).find((node) => node.textContent?.includes("items.ragVisualization"));

    // After V3: "current" badge removed; verify active section is identified by expanded state
    const analysisToggle = view.container.querySelector(
      'button[aria-controls="sidebar-section-analysis"]',
    ) as HTMLButtonElement;
    expect(analysisToggle?.getAttribute("aria-expanded")).toBe("true");
    expect(knowledgeBaseLink?.getAttribute("aria-current")).toBeNull();
    expect(evaluationsLink?.getAttribute("aria-current")).toBe("page");
    expect(ragVisualizationLink).toBeUndefined();

    view.unmount();
  });

  it("maps dataset and knowledge labels to the intended routes", () => {
    const view = renderComponent(
      React.createElement(Navbar, { sidebar: createSidebar() }),
    );

    const datasetsLink = Array.from(view.container.querySelectorAll("a")).find(
      (node) => node.textContent?.includes(chatMessages.Navbar.items.datasets),
    );
    const knowledgeLink = Array.from(view.container.querySelectorAll("a")).find(
      (node) =>
        node.textContent?.includes(chatMessages.Navbar.items.knowledgeBase),
    );

    expect(datasetsLink?.getAttribute("href")).toBe("/datasets");
    expect(knowledgeLink?.getAttribute("href")).toBe("/knowledge");

    view.unmount();
  });

  it("offers one appearance entry from the global navigation", () => {
    const view = renderComponent(
      React.createElement(Navbar, { sidebar: createSidebar() }),
    );

    expect(
      view.container.querySelector('[data-testid="mode-toggle"]'),
    ).not.toBeNull();
    expect(view.container.textContent).toContain("界面外观");
    expect(view.container.textContent).not.toContain("5 种风格");

    view.unmount();
  });

  it("preserves manually collapsed sections across remounts while opening the active section", () => {
    routerMocks.pathname = "/";

    const firstView = renderComponent(
      React.createElement(Navbar, { sidebar: createSidebar() }),
    );
    const coreToggle = firstView.container.querySelector(
      'button[aria-controls="sidebar-section-core"]',
    ) as HTMLButtonElement;
    const knowledgeToggle = firstView.container.querySelector(
      'button[aria-controls="sidebar-section-knowledge"]',
    ) as HTMLButtonElement;

    act(() => {
      coreToggle.click();
      knowledgeToggle.click();
    });

    firstView.unmount();

    routerMocks.pathname = "/graph";

    const secondView = renderComponent(
      React.createElement(Navbar, { sidebar: createSidebar() }),
    );
    const coreToggleAfterRemount = secondView.container.querySelector(
      'button[aria-controls="sidebar-section-core"]',
    ) as HTMLButtonElement;
    const knowledgeToggleAfterRemount = secondView.container.querySelector(
      'button[aria-controls="sidebar-section-knowledge"]',
    ) as HTMLButtonElement;
    const analysisToggle = secondView.container.querySelector(
      'button[aria-controls="sidebar-section-analysis"]',
    ) as HTMLButtonElement;
    const graphLink = Array.from(
      secondView.container.querySelectorAll("a"),
    ).find((node) => node.textContent?.includes("items.knowledgeGraph"));

    expect(coreToggleAfterRemount.getAttribute("aria-expanded")).toBe("false");
    expect(knowledgeToggleAfterRemount.getAttribute("aria-expanded")).toBe(
      "false",
    );
    expect(analysisToggle.getAttribute("aria-expanded")).toBe("true");
    expect(graphLink?.getAttribute("aria-current")).toBe("page");

    secondView.unmount();
  });

  it("keeps permission-gated navigation stable across hydration when tenant access is client-cached", async () => {
    routerMocks.pathname = "/usage";
    tenantAccessMock.current = { data: undefined };
    const html = renderToString(
      React.createElement(Navbar, { sidebar: createSidebar() }),
    );

    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.appendChild(container);
    tenantAccessMock.current = { data: adminTenantAccess };

    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    let root: ReturnType<typeof hydrateRoot> | null = null;

    await act(async () => {
      root = hydrateRoot(
        container,
        React.createElement(Navbar, { sidebar: createSidebar() }),
      );
      await Promise.resolve();
    });

    const errorOutput = consoleError.mock.calls
      .map((call) => call.join(" "))
      .join("\n");
    expect(errorOutput).not.toContain("Hydration failed");

    await act(async () => {
      root?.unmount();
    });
    container.remove();
  });

  it("renders a 64px icon rail with tooltips, an active foreground line and every visible module", () => {
    routerMocks.pathname = "/evaluations";
    const view = renderComponent(
      React.createElement(Navbar, {
        sidebar: createSidebar({ isExpanded: false, isCollapsed: true }),
      }),
    );

    const nav = view.container.querySelector("#mimirq-sidebar");
    expect(nav?.getAttribute("data-navbar-state")).toBe("collapsed");
    expect(nav?.className).toContain("md:w-16");
    const sectionToggles = view.container.querySelectorAll(
      'button[aria-controls^="sidebar-section-"]',
    );
    expect(sectionToggles.length).toBeGreaterThan(0);
    for (const sectionToggle of Array.from(sectionToggles)) {
      expect(sectionToggle.hasAttribute("hidden")).toBe(true);
    }
    expect(
      view.container
        .querySelector("#sidebar-section-system")
        ?.hasAttribute("hidden"),
    ).toBe(false);

    const datasets = view.container.querySelector(
      'a[data-navbar-item="/datasets"]',
    );
    expect(datasets?.textContent).toBe("");
    expect(datasets?.getAttribute("aria-label")).toBe(
      chatMessages.Navbar.items.datasets,
    );
    expect(datasets?.getAttribute("title")).toBe(
      chatMessages.Navbar.items.datasets,
    );

    const active = view.container.querySelector('a[aria-current="page"]');
    expect(active?.getAttribute("data-navbar-item")).toBe("/evaluations");
    expect(active?.className).toContain("bg-raised");
    expect(active?.className).toContain("before:bg-foreground");
    expect(active?.className).toContain("text-foreground");

    for (const href of [
      "/",
      "/knowledge",
      "/knowledge/ingestion",
      "/settings",
    ]) {
      expect(
        view.container.querySelector(`a[data-navbar-item="${href}"]`),
      ).not.toBeNull();
    }

    view.unmount();
  });

  it("keeps focus and tab access on a nav item while the rail switches to icon-only", () => {
    routerMocks.pathname = "/datasets";
    const view = renderComponent(
      React.createElement(Navbar, { sidebar: createSidebar() }),
    );

    const link = view.container.querySelector(
      'a[data-navbar-item="/datasets"]',
    ) as HTMLAnchorElement | null;
    expect(link).not.toBeNull();
    act(() => {
      link?.focus();
    });
    expect(document.activeElement).toBe(link);

    act(() => {
      view.rerender(
        React.createElement(Navbar, {
          sidebar: createSidebar({ isExpanded: false, isCollapsed: true }),
        }),
      );
    });

    const collapsedLink = view.container.querySelector(
      'a[data-navbar-item="/datasets"]',
    );
    // The anchor stays mounted while the label span and group headings disappear.
    expect(collapsedLink).toBe(link);
    expect(document.activeElement).toBe(link);
    expect(link?.getAttribute("title")).toBe(
      chatMessages.Navbar.items.datasets,
    );
    expect(link?.getAttribute("aria-label")).toBe(
      chatMessages.Navbar.items.datasets,
    );
    expect(link?.getAttribute("tabindex")).toBeNull();
    expect(link?.closest("nav")?.hasAttribute("inert")).toBe(false);

    act(() => {
      view.rerender(React.createElement(Navbar, { sidebar: createSidebar() }));
    });
    expect(document.activeElement).toBe(link);

    view.unmount();
  });

  it("keeps the expanded rail at 224px and marks closed section panels inert", () => {
    routerMocks.pathname = "/";
    const view = renderComponent(
      React.createElement(Navbar, { sidebar: createSidebar() }),
    );

    const nav = view.container.querySelector("#mimirq-sidebar");
    expect(nav?.getAttribute("data-navbar-state")).toBe("expanded");
    expect(nav?.className).toContain("md:w-56");
    expect(nav?.getAttribute("aria-hidden")).toBeNull();
    expect(nav?.hasAttribute("inert")).toBe(false);

    const systemPanel = view.container.querySelector("#sidebar-section-system");
    expect(systemPanel?.getAttribute("aria-hidden")).toBe("true");
    expect(systemPanel?.hasAttribute("inert")).toBe(true);

    const knowledgePanel = view.container.querySelector(
      "#sidebar-section-knowledge",
    );
    expect(knowledgePanel?.hasAttribute("inert")).toBe(false);

    view.unmount();
  });

  it("traps Tab inside the open drawer and returns focus on backdrop click", () => {
    const closeDrawer = vi.fn();
    const toggleButton = document.createElement("button");
    document.body.appendChild(toggleButton);
    const toggleButtonRef = { current: toggleButton };
    const view = renderComponent(
      React.createElement(Navbar, {
        sidebar: createSidebar({
          breakpoint: "mobile",
          isOverlay: true,
          isDrawerOpen: true,
          isVisible: true,
          closeDrawer,
        }),
        toggleButtonRef,
      }),
    );

    const nav = view.container.querySelector(
      "#mimirq-sidebar",
    ) as HTMLElement | null;
    expect(nav).not.toBeNull();
    const focusable = Array.from(
      nav?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) ?? [],
    ).filter(
      (element) =>
        element.getAttribute("tabindex") !== "-1" &&
        !element.closest('[hidden], [inert], [aria-hidden="true"]'),
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    act(() => {
      first.focus();
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Tab",
          shiftKey: true,
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    expect(document.activeElement).toBe(last);

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Tab",
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    expect(document.activeElement).toBe(first);

    const backdrop = view.container.querySelector(
      "[data-navbar-backdrop]",
    ) as HTMLButtonElement | null;
    expect(backdrop?.getAttribute("tabindex")).toBe("-1");
    act(() => {
      backdrop?.click();
    });

    expect(closeDrawer).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(toggleButton);

    view.unmount();
    toggleButton.remove();
  });

  it("hides a closed overlay from focus and closes it with Escape", () => {
    const closeDrawer = vi.fn();
    const toggleButton = document.createElement("button");
    document.body.appendChild(toggleButton);
    const toggleButtonRef = { current: toggleButton };
    const closed = renderComponent(
      React.createElement(Navbar, {
        sidebar: createSidebar({
          breakpoint: "mobile",
          isOverlay: true,
          isExpanded: false,
          isVisible: false,
          closeDrawer,
        }),
        toggleButtonRef,
      }),
    );

    const closedNav = closed.container.querySelector("#mimirq-sidebar");
    expect(closedNav?.getAttribute("data-navbar-state")).toBe("overlay-closed");
    expect(closedNav?.getAttribute("aria-hidden")).toBe("true");
    expect(closedNav?.hasAttribute("hidden")).toBe(true);
    expect(closedNav?.hasAttribute("inert")).toBe(true);
    expect(closed.container.querySelector("[data-navbar-backdrop]")).toBeNull();
    closed.unmount();

    const open = renderComponent(
      React.createElement(Navbar, {
        sidebar: createSidebar({
          breakpoint: "mobile",
          isOverlay: true,
          isDrawerOpen: true,
          isVisible: true,
          closeDrawer,
        }),
        toggleButtonRef,
      }),
    );

    const openNav = open.container.querySelector("#mimirq-sidebar");
    expect(openNav?.getAttribute("data-navbar-state")).toBe("overlay-open");
    expect(openNav?.getAttribute("aria-hidden")).toBeNull();
    expect(openNav?.hasAttribute("hidden")).toBe(false);
    expect(openNav?.hasAttribute("inert")).toBe(false);
    expect(
      open.container.querySelector("[data-navbar-backdrop]"),
    ).not.toBeNull();

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });

    expect(closeDrawer).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(toggleButton);

    open.unmount();
    toggleButton.remove();
  });
});

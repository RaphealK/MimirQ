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

import { AppFrameTopbar } from "./app-frame-topbar";

function renderTopbar() {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;

  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(React.createElement(AppFrameTopbar));
  });

  return {
    container,
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
});

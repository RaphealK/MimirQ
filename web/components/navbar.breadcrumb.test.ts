// Source contract check only; this is not behavior coverage.
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@/i18n/navigation", () => ({
  Link: () => null,
  usePathname: () => "/",
  useRouter: () => ({ prefetch: vi.fn(), push: vi.fn() }),
}));
vi.mock("@/components/mode-toggle", () => ({ ModeToggle: () => null }));
vi.mock("@/components/ui/button", () => ({ Button: () => null }));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    user: null,
    isAuthenticated: false,
    isDevMode: false,
    logout: vi.fn(),
  }),
}));
vi.mock("@/hooks/use-tenant-access", () => ({
  useTenantAccess: () => ({ data: undefined }),
}));

import { getNavigationBreadcrumb } from "./navbar";

describe("navbar breadcrumb", () => {
  it("uses the most specific navigation entry for the current location", () => {
    expect(getNavigationBreadcrumb("/")).toEqual({
      sectionTitleKey: "sections.core",
      itemLabelKey: "items.conversation",
    });
    expect(getNavigationBreadcrumb("/knowledge/ingestion")).toEqual({
      sectionTitleKey: "sections.ingestion",
      itemLabelKey: "items.ingestion",
    });
    expect(getNavigationBreadcrumb("/knowledge/feedback")).toEqual({
      sectionTitleKey: "sections.knowledge",
      itemLabelKey: "items.feedback",
    });
    expect(getNavigationBreadcrumb("/datasets/abc/health")).toEqual({
      sectionTitleKey: "sections.knowledge",
      itemLabelKey: "items.datasets",
    });
  });

  it("follows the existing parent-route mapping", () => {
    expect(getNavigationBreadcrumb("/knowledge/similarity")).toEqual({
      sectionTitleKey: "sections.analysis",
      itemLabelKey: "items.ragas",
    });
  });

  it("returns null for routes outside the navigation information architecture", () => {
    expect(getNavigationBreadcrumb("/logos-preview")).toBeNull();
  });
});

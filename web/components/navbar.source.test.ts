// Source contract check only; this is not behavior coverage.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("navbar source", () => {
  it("skips dev route prefetch in automated browsers", () => {
    const src = fs.readFileSync(path.resolve(__dirname, "navbar.tsx"), "utf8");

    expect(src).toContain("if (globalThis.navigator?.webdriver) return");
    expect(src).toContain("router.prefetch(href)");
  });

  it("does not force prefetching every sidebar menu route link", () => {
    const src = fs.readFileSync(path.resolve(__dirname, "navbar.tsx"), "utf8");

    expect(src).toContain("prefetch={false}");
  });

  it("uses locale-aware navigation helpers and has locale wrappers for navbar routes", () => {
    const src = fs.readFileSync(path.resolve(__dirname, "navbar.tsx"), "utf8");
    const webRoot = path.resolve(__dirname, "..");
    const wrapperPaths = [
      "app/[locale]/audit/page.tsx",
      "app/[locale]/auth/page.tsx",
      "app/[locale]/chunk-preview/page.tsx",
      "app/[locale]/data-governance/page.tsx",
      "app/[locale]/data-governance/common-lines/page.tsx",
      "app/[locale]/data-governance/profiles/page.tsx",
      "app/[locale]/datasets/page.tsx",
      "app/[locale]/diagnostics/page.tsx",
      "app/[locale]/evaluations/ablations/page.tsx",
      "app/[locale]/graph/page.tsx",
      "app/[locale]/graph/diagnostics/page.tsx",
      "app/[locale]/graph/snapshots/page.tsx",
      "app/[locale]/knowledge/feedback/page.tsx",
      "app/[locale]/knowledge/ingestion/page.tsx",
      "app/[locale]/knowledge/quarantine/page.tsx",
      "app/[locale]/knowledge/similarity/page.tsx",
      "app/[locale]/parsing/page.tsx",
      "app/[locale]/prompts/page.tsx",
      "app/[locale]/reports/page.tsx",
      "app/[locale]/settings/page.tsx",
      "app/[locale]/settings/groups/page.tsx",
      "app/[locale]/settings/rbac/page.tsx",
      "app/[locale]/usage/page.tsx",
    ];

    expect(src).toMatch(
      /import \{ Link, usePathname, useRouter \} from ["']@\/i18n\/navigation["']/,
    );
    expect(src).not.toContain("import Link from 'next/link'");
    expect(src).not.toContain('import Link from "next/link"');
    expect(src).not.toMatch(
      /import \{ usePathname, useRouter \} from ["']next\/navigation["']/,
    );

    for (const wrapperPath of wrapperPaths) {
      expect(fs.existsSync(path.resolve(webRoot, wrapperPath))).toBe(true);
    }
  });

  it("declares translations for the navbar copy", () => {
    const src = fs.readFileSync(path.resolve(__dirname, "navbar.tsx"), "utf8");
    const topbarSrc = fs.readFileSync(
      path.resolve(__dirname, "app-frame-topbar.tsx"),
      "utf8",
    );

    expect(src).toMatch(/import \{ useTranslations \} from ["']next-intl["']/);
    expect(src).toMatch(/const t = useTranslations\(["']Navbar["']\)/);
    expect(src).toMatch(/t\(["']actions\.newConversation["']\)/);
    expect(src).toMatch(/titleKey:\s*["']sections\.core["']/);
    expect(src).toContain("t(section.titleKey)");
    // Command search lives in the topbar, not the rail.
    expect(src).not.toContain("command.triggerLabel");
    expect(topbarSrc).toMatch(/t\(["']command\.triggerLabel["']\)/);
  });

  it("keeps the engineering shell at a 224px rail and 48px topbar", () => {
    const src = fs.readFileSync(path.resolve(__dirname, "navbar.tsx"), "utf8");
    const topbarSrc = fs.readFileSync(
      path.resolve(__dirname, "app-frame-topbar.tsx"),
      "utf8",
    );

    expect(src).toContain("w-56 shrink-0 flex-col");
    expect(src).toContain("h-12");
    expect(src).toContain("size-11");
    expect(topbarSrc).toContain("h-12 shrink-0 items-center");
    expect(topbarSrc).toContain("h-11 w-11");
  });

  it("keeps the topbar diagnostics guard hydration-equivalent to the rail", () => {
    const topbarSrc = fs.readFileSync(
      path.resolve(__dirname, "app-frame-topbar.tsx"),
      "utf8",
    );

    expect(topbarSrc).toContain("hasHydratedNavigationAccess");
    expect(topbarSrc).toMatch(
      /allowDevNavigation\s*=\s*hasHydratedNavigationAccess\s*&&\s*isDevMode/,
    );
    expect(topbarSrc).toMatch(/tenantAccessAllows\(\s*navigationTenantAccess/);
  });

  it("filters system navigation by tenant permissions", () => {
    const src = fs.readFileSync(path.resolve(__dirname, "navbar.tsx"), "utf8");

    expect(src).toMatch(
      /import \{ useTenantAccess \} from ["']@\/hooks\/use-tenant-access["']/,
    );
    expect(src).toContain(
      "requiredPermission: TENANT_PERMISSIONS.OBSERVABILITY_READ",
    );
    expect(src).toContain("requiredPermission: TENANT_PERMISSIONS.USAGE_READ");
    expect(src).toContain("requiredPermission: TENANT_PERMISSIONS.AUDIT_READ");
    expect(src).toContain(
      "requiredPermission: TENANT_PERMISSIONS.SETTINGS_READ",
    );
    expect(src).toContain("visibleMenuSections");
    expect(src).toContain("hasHydratedNavigationAccess");
    expect(src).toContain(
      "tenantAccessAllows(navigationTenantAccess, permission)",
    );
    expect(src).toContain(
      "canShowAdminControlledNavigationModule(navigationTenantAccess, moduleKey)",
    );
  });

  it("keeps daily navigation focused while advanced vector diagnostics stay out of the sidebar", () => {
    const src = fs.readFileSync(path.resolve(__dirname, "navbar.tsx"), "utf8");
    const chatMessages = fs.readFileSync(
      path.resolve(__dirname, "../i18n/messages/zh-CN/chat.ts"),
      "utf8",
    );

    expect(src).toMatch(
      /labelKey:\s*["']items\.knowledgeBase["'],\s*href:\s*["']\/knowledge["']/,
    );
    expect(src).toMatch(
      /labelKey:\s*["']items\.datasets["'],\s*href:\s*["']\/datasets["']/,
    );
    expect(src.indexOf("items.datasets")).toBeLessThan(
      src.indexOf("items.knowledgeBase"),
    );

    expect(src).not.toContain("ragVisualization");
    expect(src).toMatch(
      /["']\/knowledge\/similarity["']:\s*["']\/evaluations["']/,
    );
    expect(src.indexOf("items.knowledgeGraph")).toBeLessThan(
      src.indexOf("items.ragas"),
    );

    expect(chatMessages).toContain("datasets: '数据集'");
    expect(chatMessages).toContain("knowledgeBase: '知识库'");
    expect(chatMessages).toContain("ragas: 'RAG评测'");
  });
});

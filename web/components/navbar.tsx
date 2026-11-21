/**
 * 左侧固定导航栏组件（可收缩 rail）。
 *
 * 展开 224px；收起 64px，只保留图标、工具提示与可访问名称。
 * 768–1023px 默认收起，< 768px 由顶栏按钮控制遮罩抽屉。
 * 顶栏负责当前位置、命令搜索、侧栏开关与依赖状态，见 app-frame-topbar.tsx。
 */
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import {
  Activity,
  BarChart3,
  Braces,
  ChevronDown,
  ChevronRight,
  Coins,
  Database,
  FileText,
  History,
  Layers,
  LogIn,
  LogOut,
  MessageSquare,
  Plus,
  Scissors,
  Settings,
  Share2,
  ShieldAlert,
  ShieldCheck,
  Star,
  User,
  Users,
  Wand2,
} from "lucide-react";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { readClientStorage, writeClientStorage } from "@/lib/client-storage";
import { MIMIRQ_MARK_PATH } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { ModeToggle } from "@/components/mode-toggle";
import { useAuth } from "@/hooks/use-auth";
import type { NavbarSidebarController } from "@/hooks/use-navbar-sidebar";
import { useTenantAccess } from "@/hooks/use-tenant-access";
import {
  TENANT_PERMISSIONS,
  tenantAccessAllows,
  type TenantPermission,
} from "@/lib/tenant-permissions";
import {
  canShowAdminControlledNavigationModule,
  type AdminControlledNavigationModule,
} from "@/lib/navigation-visibility";

type SectionId = "core" | "ingestion" | "knowledge" | "analysis" | "system";

type MenuItem = {
  icon: React.ComponentType<{ className?: string }>;
  labelKey: string;
  href: string;
  requiredPermission?: TenantPermission;
  visibilityKey?: AdminControlledNavigationModule;
};

type MenuSection = {
  id: SectionId;
  titleKey: string;
  items: MenuItem[];
};

type NavigationBreadcrumb = {
  sectionTitleKey: string;
  itemLabelKey: string;
};

// 导航信息架构：按「核心 → 入库流程 → 知识库管理 → 分析工具 → 系统」分组，降低认知负担。
const menuSections: MenuSection[] = [
  {
    id: "core",
    titleKey: "sections.core",
    items: [
      { icon: MessageSquare, labelKey: "items.conversation", href: "/" },
      { icon: History, labelKey: "items.history", href: "/history" },
    ],
  },
  {
    id: "knowledge",
    titleKey: "sections.knowledge",
    items: [
      { icon: Layers, labelKey: "items.datasets", href: "/datasets" },
      { icon: Database, labelKey: "items.knowledgeBase", href: "/knowledge" },
      {
        icon: ShieldAlert,
        labelKey: "items.quarantine",
        href: "/knowledge/quarantine",
      },
      { icon: Star, labelKey: "items.feedback", href: "/knowledge/feedback" },
    ],
  },
  {
    id: "ingestion",
    titleKey: "sections.ingestion",
    items: [
      {
        icon: Activity,
        labelKey: "items.ingestion",
        href: "/knowledge/ingestion",
      },
      { icon: FileText, labelKey: "items.parsing", href: "/parsing" },
      {
        icon: ShieldCheck,
        labelKey: "items.dataGovernance",
        href: "/data-governance",
      },
      {
        icon: Braces,
        labelKey: "items.governanceProfiles",
        href: "/data-governance/profiles",
        visibilityKey: "governanceProfiles",
      },
      {
        icon: Scissors,
        labelKey: "items.chunkPreview",
        href: "/chunk-preview",
      },
    ],
  },
  {
    id: "analysis",
    titleKey: "sections.analysis",
    items: [
      {
        icon: Share2,
        labelKey: "items.knowledgeGraph",
        href: "/graph",
        visibilityKey: "knowledgeGraph",
      },
      {
        icon: BarChart3,
        labelKey: "items.ragas",
        href: "/evaluations",
        visibilityKey: "ragas",
      },
      {
        icon: FileText,
        labelKey: "items.reports",
        href: "/reports",
        visibilityKey: "reports",
      },
      {
        icon: Wand2,
        labelKey: "items.prompts",
        href: "/prompts",
        visibilityKey: "prompts",
      },
    ],
  },
  {
    id: "system",
    titleKey: "sections.system",
    items: [
      {
        icon: Activity,
        labelKey: "items.diagnostics",
        href: "/diagnostics",
        requiredPermission: TENANT_PERMISSIONS.OBSERVABILITY_READ,
      },
      {
        icon: Coins,
        labelKey: "items.usage",
        href: "/usage",
        requiredPermission: TENANT_PERMISSIONS.USAGE_READ,
      },
      {
        icon: ShieldCheck,
        labelKey: "items.audit",
        href: "/audit",
        requiredPermission: TENANT_PERMISSIONS.AUDIT_READ,
      },
      {
        icon: User,
        labelKey: "items.members",
        href: "/settings/rbac",
        requiredPermission: TENANT_PERMISSIONS.SETTINGS_READ,
      },
      {
        icon: Users,
        labelKey: "items.groups",
        href: "/settings/groups",
        requiredPermission: TENANT_PERMISSIONS.SETTINGS_READ,
      },
      {
        icon: Settings,
        labelKey: "items.settings",
        href: "/settings",
        requiredPermission: TENANT_PERMISSIONS.SETTINGS_READ,
      },
    ],
  },
];

const DEFAULT_OPEN_SECTIONS = new Set<SectionId>([
  "core",
  "knowledge",
  "ingestion",
  "analysis",
]);
const OPEN_SECTIONS_STORAGE_KEY = "mimirq_navbar_open_sections_v2";
const DRAWER_FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function getDrawerFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(DRAWER_FOCUSABLE_SELECTOR),
  ).filter(
    (element) =>
      element.getAttribute("tabindex") !== "-1" &&
      !element.closest('[hidden], [inert], [aria-hidden="true"]'),
  );
}

const NAVIGATION_PARENT_ROUTES: Record<string, string> = {
  "/knowledge/similarity": "/evaluations",
};

function isActiveRoute(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function getMostSpecificActiveHref(
  pathname: string,
  items: MenuItem[],
): string | null {
  let activeHref: string | null = null;

  for (const item of items) {
    if (!isActiveRoute(pathname, item.href)) continue;
    if (activeHref === null || item.href.length > activeHref.length) {
      activeHref = item.href;
    }
  }

  return activeHref;
}

function sectionHasActiveRoute(activeHref: string | null, items: MenuItem[]) {
  if (!activeHref) return false;
  return items.some((item) => item.href === activeHref);
}

/**
 * 由当前路径解析顶栏面包屑。返回 i18n key，保持导航标签与侧栏同源。
 */
export function getNavigationBreadcrumb(
  pathname: string,
): NavigationBreadcrumb | null {
  const activePathname = NAVIGATION_PARENT_ROUTES[pathname] || pathname;
  let best:
    | (NavigationBreadcrumb & {
        hrefLength: number;
      })
    | null = null;

  for (const section of menuSections) {
    for (const item of section.items) {
      if (!isActiveRoute(activePathname, item.href)) continue;
      if (best && item.href.length <= best.hrefLength) continue;
      best = {
        sectionTitleKey: section.titleKey,
        itemLabelKey: item.labelKey,
        hrefLength: item.href.length,
      };
    }
  }

  if (!best) return null;
  return {
    sectionTitleKey: best.sectionTitleKey,
    itemLabelKey: best.itemLabelKey,
  };
}

function createInitialOpenSections(): Record<SectionId, boolean> {
  return menuSections.reduce<Record<SectionId, boolean>>(
    (sections, section) => {
      sections[section.id] = DEFAULT_OPEN_SECTIONS.has(section.id);
      return sections;
    },
    {
      core: false,
      ingestion: false,
      knowledge: false,
      analysis: false,
      system: false,
    },
  );
}

function sanitizeOpenSections(value: unknown): Record<SectionId, boolean> {
  const fallback = createInitialOpenSections();
  if (!value || typeof value !== "object") return fallback;

  const candidate = value as Partial<Record<SectionId, unknown>>;
  return {
    core: typeof candidate.core === "boolean" ? candidate.core : fallback.core,
    ingestion:
      typeof candidate.ingestion === "boolean"
        ? candidate.ingestion
        : fallback.ingestion,
    knowledge:
      typeof candidate.knowledge === "boolean"
        ? candidate.knowledge
        : fallback.knowledge,
    analysis:
      typeof candidate.analysis === "boolean"
        ? candidate.analysis
        : fallback.analysis,
    system:
      typeof candidate.system === "boolean"
        ? candidate.system
        : fallback.system,
  };
}

function loadOpenSections(): Record<SectionId, boolean> {
  if (globalThis.window === undefined) return createInitialOpenSections();

  try {
    const raw = readClientStorage(OPEN_SECTIONS_STORAGE_KEY);
    if (!raw) return createInitialOpenSections();
    return sanitizeOpenSections(JSON.parse(raw));
  } catch {
    return createInitialOpenSections();
  }
}

export function Navbar({
  sidebar,
  toggleButtonRef,
}: Readonly<{
  sidebar: NavbarSidebarController;
  toggleButtonRef?: RefObject<HTMLButtonElement | null>;
}>) {
  const navRef = useRef<HTMLElement | null>(null);
  const firstActionRef = useRef<HTMLButtonElement | null>(null);
  const previousDrawerOpenRef = useRef(sidebar.isDrawerOpen);
  const [openSections, setOpenSections] = useState<Record<SectionId, boolean>>(
    createInitialOpenSections,
  );
  const [hasHydratedOpenSections, setHasHydratedOpenSections] = useState(false);
  const [hasHydratedNavigationAccess, setHasHydratedNavigationAccess] =
    useState(false);
  const {
    isOverlay,
    isDrawerOpen,
    isExpanded,
    isCollapsed,
    isVisible,
    closeDrawer,
  } = sidebar;
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, isDevMode, logout } = useAuth();
  const t = useTranslations("Navbar");
  const tenantAccess = useTenantAccess();
  const navigationTenantAccess = hasHydratedNavigationAccess
    ? tenantAccess.data
    : undefined;
  const allowDevNavigation = hasHydratedNavigationAccess && isDevMode;
  const canAccessPermission = useCallback(
    (permission?: TenantPermission) =>
      !permission ||
      allowDevNavigation ||
      tenantAccessAllows(navigationTenantAccess, permission),
    [allowDevNavigation, navigationTenantAccess],
  );
  const canShowNavigationModule = useCallback(
    (moduleKey?: AdminControlledNavigationModule) =>
      !moduleKey ||
      allowDevNavigation ||
      canShowAdminControlledNavigationModule(navigationTenantAccess, moduleKey),
    [allowDevNavigation, navigationTenantAccess],
  );
  const visibleMenuSections = useMemo(
    () =>
      menuSections
        .map((section) => ({
          ...section,
          items: section.items.filter(
            (item) =>
              canAccessPermission(item.requiredPermission) &&
              canShowNavigationModule(item.visibilityKey),
          ),
        }))
        .filter((section) => section.items.length > 0),
    [canAccessPermission, canShowNavigationModule],
  );
  const visibleMenuItems = useMemo(
    () => visibleMenuSections.flatMap((section) => section.items),
    [visibleMenuSections],
  );
  const activePathname = NAVIGATION_PARENT_ROUTES[pathname] || pathname;
  const activeHref = getMostSpecificActiveHref(
    activePathname,
    visibleMenuItems,
  );
  const handleNavigate = useCallback(() => {
    if (isOverlay) closeDrawer();
  }, [closeDrawer, isOverlay]);
  const toggleSection = useCallback((sectionId: SectionId) => {
    setOpenSections((current) => ({
      ...current,
      [sectionId]: !current[sectionId],
    }));
  }, []);

  // Accessibility: while the overlay drawer is open, Escape closes it and
  // returns focus to the topbar toggle; Tab is trapped inside the drawer.
  useEffect(() => {
    if (!isOverlay || !isDrawerOpen) return;
    if (globalThis.window === undefined) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;

      if (event.key === "Escape") {
        event.preventDefault();
        closeDrawer();
        toggleButtonRef?.current?.focus();
        return;
      }

      if (event.key !== "Tab") return;

      const nav = navRef.current;
      if (!nav) return;
      const focusable = getDrawerFocusableElements(nav);
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      const focusIsInsideNav = active instanceof Node && nav.contains(active);

      if (event.shiftKey) {
        if (!focusIsInsideNav || active === first) {
          event.preventDefault();
          last.focus();
        }
        return;
      }

      if (!focusIsInsideNav || active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    globalThis.window.addEventListener("keydown", onKeyDown);
    return () => globalThis.window.removeEventListener("keydown", onKeyDown);
  }, [closeDrawer, isDrawerOpen, isOverlay, toggleButtonRef]);

  // Accessibility: 抽屉打开时焦点进入导航；关闭后把焦点交还顶栏开关。
  // The shell removes inert from the topbar during the closing commit, so the
  // restore is deferred one frame rather than attempted while still inert.
  useEffect(() => {
    if (globalThis.window === undefined) return;
    const wasOpen = previousDrawerOpenRef.current;
    previousDrawerOpenRef.current = isDrawerOpen;
    if (!isOverlay || wasOpen === isDrawerOpen) return;

    const toggleButton = toggleButtonRef?.current ?? null;
    if (isDrawerOpen) {
      if (toggleButton && document.activeElement === toggleButton) {
        firstActionRef.current?.focus();
      }
      return;
    }

    if (!toggleButton) return;
    // The app shell marks the topbar inert while the drawer is open. Wait for
    // the closing commit to remove that attribute before restoring focus.
    const focusToggle = () => toggleButton.focus();
    if (typeof globalThis.requestAnimationFrame === "function") {
      const frame = globalThis.requestAnimationFrame(focusToggle);
      return () => globalThis.cancelAnimationFrame(frame);
    }
    const timer = globalThis.setTimeout(focusToggle, 0);
    return () => globalThis.clearTimeout(timer);
  }, [isDrawerOpen, isOverlay, toggleButtonRef]);

  useEffect(() => {
    setOpenSections(loadOpenSections());
    setHasHydratedOpenSections(true);
    // Keep SSR and the first client render structurally identical. Tenant access can
    // be cached on the client, so applying it before mount can reorder/insert links.
    setHasHydratedNavigationAccess(true);
  }, []);

  useEffect(() => {
    const activeSection = visibleMenuSections.find((section) =>
      sectionHasActiveRoute(activeHref, section.items),
    );
    if (!activeSection) return;

    setOpenSections((current) => {
      if (current[activeSection.id]) return current;
      return {
        ...current,
        [activeSection.id]: true,
      };
    });
  }, [activeHref, visibleMenuSections]);

  useEffect(() => {
    if (!hasHydratedOpenSections) return;
    if (globalThis.window === undefined) return;
    writeClientStorage(OPEN_SECTIONS_STORAGE_KEY, JSON.stringify(openSections));
  }, [hasHydratedOpenSections, openSections]);

  // Dev UX: warm up route chunks in the background so first-click navigation feels snappier.
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    if (globalThis.window === undefined) return;
    if (globalThis.navigator?.webdriver) return;
    const key = "__mimirq_routes_prefetched__";
    const routeCache = globalThis.window as typeof globalThis.window &
      Record<string, boolean>;
    if (routeCache[key]) return;
    routeCache[key] = true;

    const hrefs = visibleMenuItems.map((i) => i.href).filter(Boolean);
    const prefetchAll = () => {
      for (const href of hrefs) {
        if (href === pathname) continue;
        try {
          router.prefetch(href);
        } catch {
          // ignore
        }
      }
    };

    // Prefer idle time to avoid blocking initial render.
    const w = globalThis.window as Window & {
      requestIdleCallback?: (
        callback: (deadline: {
          didTimeout: boolean;
          timeRemaining: () => number;
        }) => void,
        options?: { timeout?: number },
      ) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (typeof w.requestIdleCallback === "function") {
      const id = w.requestIdleCallback(prefetchAll, { timeout: 2000 });
      return () => w.cancelIdleCallback?.(id);
    }

    const timer = setTimeout(prefetchAll, 800);
    return () => clearTimeout(timer);
  }, [router, pathname, visibleMenuItems]);

  const userDisplayName =
    user?.username ||
    user?.email ||
    (isDevMode ? t("user.developerMode") : t("user.unauthenticatedName"));
  const userStatusLine = isAuthenticated
    ? user?.email || t("user.onlineStatus")
    : t("user.offlineEnvironment");
  const canOpenSettings = canAccessPermission(TENANT_PERMISSIONS.SETTINGS_READ);

  const renderMenuItem = (item: MenuItem) => {
    const Icon = item.icon;
    const isActive = activeHref === item.href;
    const label = t(item.labelKey);

    return (
      <Link
        key={item.href}
        href={item.href}
        prefetch={false}
        onClick={handleNavigate}
        aria-current={isActive ? "page" : undefined}
        aria-label={isCollapsed ? label : undefined}
        title={isCollapsed ? label : undefined}
        data-navbar-item={item.href}
        data-navbar-active={isActive ? "true" : undefined}
        className={cn(
          "group relative flex items-center rounded-md text-compact transition-colors focus-ring",
          "min-h-11 pointer-fine:md:min-h-8",
          "before:pointer-events-none before:absolute before:inset-y-1 before:left-0 before:w-0.5 before:rounded-full before:transition-colors",
          isCollapsed ? "w-full justify-center px-0" : "w-full gap-2.5 px-2",
          isActive
            ? "bg-raised font-semibold text-foreground before:bg-foreground"
            : "text-muted-foreground before:bg-transparent hover:bg-surface hover:text-foreground",
        )}
      >
        <Icon
          className={cn(
            "size-4 shrink-0",
            isActive ? "text-foreground" : "text-muted-foreground",
          )}
        />
        {!isCollapsed ? <span className="truncate">{label}</span> : null}
      </Link>
    );
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOverlay && isDrawerOpen ? (
        <button
          type="button"
          tabIndex={-1}
          aria-label={t("toolbar.sidebarClose")}
          data-navbar-backdrop="true"
          className="fixed inset-0 z-40 border-0 bg-foreground/30 p-0 transition-opacity duration-180 focus:outline-none md:hidden"
          onClick={() => {
            closeDrawer();
            toggleButtonRef?.current?.focus();
          }}
        />
      ) : null}

      <nav
        id="mimirq-sidebar"
        ref={navRef}
        aria-label={t("toolbar.navLabel")}
        aria-hidden={isVisible ? undefined : true}
        inert={isVisible ? undefined : true}
        hidden={isOverlay && !isDrawerOpen}
        data-navbar-state={
          isOverlay
            ? isDrawerOpen
              ? "overlay-open"
              : "overlay-closed"
            : isExpanded
              ? "expanded"
              : "collapsed"
        }
        className={cn(
          "z-50 flex shrink-0 flex-col border-r border-border bg-background text-foreground",
          "fixed inset-y-0 left-0 w-56 md:relative md:inset-auto",
          "transition-[width,opacity] duration-180 ease-out",
          isOverlay ? "safe-area-pt safe-area-pb safe-area-px" : "",
          isVisible ? "opacity-100" : "pointer-events-none opacity-0",
          isCollapsed ? "md:w-16" : "md:w-56",
        )}
      >
        {/* 品牌 */}
        <div
          className={cn(
            "flex h-12 shrink-0 items-center border-b border-border",
            isCollapsed ? "justify-center px-2" : "gap-2 px-3",
          )}
        >
          <Link
            href="/"
            aria-label={isCollapsed ? "MimirQ" : undefined}
            title={isCollapsed ? "MimirQ" : undefined}
            onClick={handleNavigate}
            className={cn(
              "flex min-w-0 items-center gap-2 rounded-md focus-ring pointer-coarse:min-h-11 pointer-coarse:min-w-11",
              isCollapsed ? "justify-center" : "",
            )}
          >
            <Image
              src={MIMIRQ_MARK_PATH}
              alt=""
              aria-hidden="true"
              width={28}
              height={28}
              priority
              unoptimized
              className="size-7 shrink-0 object-contain"
            />
            {!isCollapsed ? (
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-compact font-semibold leading-tight text-foreground">
                  MimirQ
                </span>
                <span className="truncate text-micro leading-tight text-subtle-foreground">
                  {t("brand.tagline")}
                </span>
              </span>
            ) : null}
          </Link>
        </div>

        {/* 新对话 */}
        <div className="px-2 pt-2">
          <button
            ref={firstActionRef}
            type="button"
            className={cn(
              "inline-flex h-11 w-full items-center justify-center gap-2 whitespace-nowrap rounded-md px-3 text-compact font-medium text-muted-foreground transition-colors duration-120 hover:bg-raised hover:text-foreground focus-ring pointer-fine:md:h-8",
              isCollapsed ? "px-0" : "justify-start",
            )}
            aria-label={t("actions.newConversation")}
            title={isCollapsed ? t("actions.newConversation") : undefined}
            onClick={() => {
              router.push("/");
              handleNavigate();
            }}
          >
            <Plus className="size-4 shrink-0" />
            {!isCollapsed ? (
              <span className="truncate">{t("actions.newConversation")}</span>
            ) : null}
          </button>
        </div>

        {/* 导航菜单 */}
        {/* Allow internal scroll so items are never clipped on short viewports. */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-1 no-scrollbar">
          <div className="space-y-1.5">
            {visibleMenuSections.map((section, index) => {
              const isOpen = openSections[section.id] ?? false;
              // 64px 图标栏没有分组标题：面板强制展开，保证所有模块可达。
              const panelIsOpen = isCollapsed || isOpen;
              const hasActiveItem = sectionHasActiveRoute(
                activeHref,
                section.items,
              );
              const ToggleIcon = isOpen ? ChevronDown : ChevronRight;

              return (
                <section
                  key={section.id}
                  data-navbar-section={section.id}
                  className={cn(
                    index > 0 ? "border-t border-border/70 pt-1.5" : "",
                  )}
                >
                  <button
                    type="button"
                    hidden={isCollapsed}
                    className={cn(
                      "flex min-h-11 w-full items-center justify-between gap-2 rounded-md px-2 text-left transition-colors focus-ring pointer-fine:md:min-h-7",
                      hasActiveItem
                        ? "text-foreground"
                        : "text-subtle-foreground hover:bg-surface hover:text-foreground",
                    )}
                    onClick={() => toggleSection(section.id)}
                    aria-expanded={isOpen}
                    aria-controls={`sidebar-section-${section.id}`}
                  >
                    <span className="min-w-0 truncate text-micro font-semibold">
                      {t(section.titleKey)}
                    </span>
                    <ToggleIcon className="size-3.5 shrink-0" />
                  </button>

                  <div
                    id={`sidebar-section-${section.id}`}
                    data-navbar-section-panel={section.id}
                    hidden={!panelIsOpen}
                    inert={panelIsOpen ? undefined : true}
                    aria-hidden={panelIsOpen ? undefined : true}
                  >
                    <div className="space-y-0.5 pb-1">
                      {section.items.map(renderMenuItem)}
                    </div>
                  </div>
                </section>
              );
            })}
          </div>
        </div>

        {/* 底部：账户与外观 */}
        <div className="shrink-0 border-t border-border p-2">
          <div
            className={cn(
              "flex items-center",
              isCollapsed ? "flex-col gap-1" : "gap-1",
            )}
          >
            <button
              type="button"
              aria-label={
                isAuthenticated ? t("user.openSettings") : t("auth.goToLogin")
              }
              title={
                isAuthenticated ? t("user.openSettings") : t("auth.goToLogin")
              }
              className={cn(
                "flex min-h-11 min-w-0 items-center rounded-md text-left transition-colors hover:bg-surface focus-ring pointer-fine:md:min-h-10",
                isCollapsed
                  ? "w-full justify-center px-0"
                  : "flex-1 gap-2 px-2 py-1",
              )}
              onClick={() => {
                if (isAuthenticated) {
                  router.push(canOpenSettings ? "/settings" : "/");
                } else {
                  router.push("/auth");
                }
                handleNavigate();
              }}
            >
              <span className="relative flex size-7 shrink-0 items-center justify-center">
                <Image
                  src={MIMIRQ_MARK_PATH}
                  alt=""
                  aria-hidden="true"
                  width={28}
                  height={28}
                  loading="eager"
                  unoptimized
                  className="size-7 object-contain"
                />
                {isAuthenticated && (
                  <span className="absolute -bottom-0.5 -right-0.5 size-2 rounded-full border border-background bg-success" />
                )}
              </span>
              {!isCollapsed ? (
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-compact font-medium text-foreground">
                    {userDisplayName}
                  </span>
                  <span className="block truncate text-micro leading-tight text-subtle-foreground">
                    {userStatusLine}
                  </span>
                </span>
              ) : null}
            </button>
            <button
              type="button"
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors duration-120 hover:bg-destructive/10 hover:text-destructive focus-ring pointer-fine:md:size-8"
              onClick={() => {
                if (isAuthenticated) {
                  logout();
                  return;
                }
                router.push("/auth");
              }}
              title={isAuthenticated ? t("auth.logout") : t("auth.login")}
              aria-label={isAuthenticated ? t("auth.logout") : t("auth.login")}
            >
              {isAuthenticated ? (
                <LogOut className="size-4" />
              ) : (
                <LogIn className="size-4" />
              )}
            </button>
          </div>

          <div
            className={cn(
              "mt-1 flex items-center rounded-md",
              isCollapsed ? "justify-center" : "gap-1 px-2",
            )}
          >
            {!isCollapsed ? (
              <span className="min-w-0 flex-1 truncate text-micro font-medium text-subtle-foreground">
                {t("toolbar.appearance")}
              </span>
            ) : null}
            <div className="shrink-0 [&_button]:size-11 pointer-fine:md:[&_button]:size-8">
              <ModeToggle />
            </div>
          </div>
        </div>
      </nav>
    </>
  );
}

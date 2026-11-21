/**
 * 左侧固定导航栏组件（224px rail）。
 *
 * 工程风骨架：品牌、新对话、分组导航、外观与账户。
 * 顶栏负责当前位置、命令搜索与依赖状态，见 app-frame-topbar.tsx。
 */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  PanelLeftClose,
  PanelLeftOpen,
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
import { Button } from "@/components/ui/button";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { readClientStorage, writeClientStorage } from "@/lib/client-storage";
import { MIMIRQ_MARK_PATH } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { ModeToggle } from "@/components/mode-toggle";
import { useAuth } from "@/hooks/use-auth";
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
  isSidebarOpen: externalIsOpen,
  setSidebarOpen: externalSetOpen,
}: Readonly<{
  isSidebarOpen?: boolean;
  setSidebarOpen?: (isOpen: boolean) => void;
}> = {}) {
  const navRef = useRef<HTMLElement | null>(null);
  const toggleButtonRef = useRef<HTMLButtonElement | null>(null);
  const firstActionRef = useRef<HTMLButtonElement | null>(null);
  const prevIsSidebarOpenRef = useRef<boolean | null>(null);
  const restoreToggleFocusOnCloseRef = useRef(false);
  const [internalIsOpen, setInternalIsOpen] = useState(true);
  const [openSections, setOpenSections] = useState<Record<SectionId, boolean>>(
    createInitialOpenSections,
  );
  const [hasHydratedOpenSections, setHasHydratedOpenSections] = useState(false);
  const [hasHydratedNavigationAccess, setHasHydratedNavigationAccess] =
    useState(false);
  const isSidebarOpen = externalIsOpen ?? internalIsOpen;
  const setSidebarOpen = externalSetOpen ?? setInternalIsOpen;
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
  const closeSidebarOnMobile = useCallback(() => {
    if (globalThis.window === undefined) return;
    try {
      if (globalThis.window.matchMedia("(max-width: 768px)").matches)
        setSidebarOpen(false);
    } catch {
      // ignore
    }
  }, [setSidebarOpen]);
  const toggleSection = useCallback((sectionId: SectionId) => {
    setOpenSections((current) => ({
      ...current,
      [sectionId]: !current[sectionId],
    }));
  }, []);
  const handleSidebarTogglePointerDown = useCallback(() => {
    restoreToggleFocusOnCloseRef.current = false;
  }, []);
  const handleSidebarToggleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        restoreToggleFocusOnCloseRef.current = true;
      }
    },
    [],
  );
  const handleSidebarToggle = useCallback(() => {
    if (isSidebarOpen) {
      restoreToggleFocusOnCloseRef.current =
        restoreToggleFocusOnCloseRef.current ||
        document.activeElement === toggleButtonRef.current;
    } else {
      restoreToggleFocusOnCloseRef.current = false;
    }
    setSidebarOpen(!isSidebarOpen);
  }, [isSidebarOpen, setSidebarOpen]);

  // Accessibility: prevent focus from entering the sidebar when collapsed/hidden.
  useEffect(() => {
    const el = navRef.current as (HTMLElement & { inert: boolean }) | null;
    if (!el) return;
    const inertNow = !isSidebarOpen;
    try {
      el.inert = inertNow;
    } catch {
      // ignore: inert is not supported in all environments
    }
  }, [isSidebarOpen]);

  // Accessibility: close the mobile overlay with Escape.
  useEffect(() => {
    if (!isSidebarOpen) return;
    if (globalThis.window === undefined) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.key !== "Escape") return;
      try {
        // Only treat as an overlay on small screens.
        if (!globalThis.window.matchMedia("(max-width: 768px)").matches) return;
      } catch {
        return;
      }
      e.preventDefault();
      restoreToggleFocusOnCloseRef.current = true;
      setSidebarOpen(false);
    };

    globalThis.window.addEventListener("keydown", onKeyDown);
    return () => globalThis.window.removeEventListener("keydown", onKeyDown);
  }, [isSidebarOpen, setSidebarOpen]);

  // Accessibility: restore focus to the toggle on close; move focus into the sidebar on open.
  useEffect(() => {
    if (globalThis.window === undefined) return;
    if (prevIsSidebarOpenRef.current === null) {
      prevIsSidebarOpenRef.current = isSidebarOpen;
      return;
    }

    const prev = prevIsSidebarOpenRef.current;
    prevIsSidebarOpenRef.current = isSidebarOpen;
    if (prev === isSidebarOpen) return;

    const active = document.activeElement;
    if (isSidebarOpen) {
      // Only move focus when the user opened the sidebar from the toggle (keyboard).
      if (
        active &&
        toggleButtonRef.current &&
        active !== toggleButtonRef.current
      )
        return;
      requestAnimationFrame(() => {
        firstActionRef.current?.focus();
      });
      return;
    }

    const navEl = navRef.current;
    const shouldRestore =
      !active ||
      active === document.body ||
      Boolean(navEl && active instanceof Node && navEl.contains(active));
    const shouldRestoreToggleFocus = restoreToggleFocusOnCloseRef.current;
    restoreToggleFocusOnCloseRef.current = false;
    if (!shouldRestore || !shouldRestoreToggleFocus) return;

    requestAnimationFrame(() => {
      toggleButtonRef.current?.focus();
    });
  }, [isSidebarOpen]);

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

  return (
    <>
      {/* Mobile Overlay */}
      {isSidebarOpen ? (
        <button
          type="button"
          aria-label={t("toolbar.sidebarClose")}
          className="fixed inset-0 z-40 border-0 bg-foreground/30 p-0 transition-opacity md:hidden focus:outline-none"
          onClick={() => {
            restoreToggleFocusOnCloseRef.current = false;
            setSidebarOpen(false);
          }}
        />
      ) : null}

      <nav
        id="mimirq-sidebar"
        ref={navRef}
        aria-label={t("toolbar.navLabel")}
        aria-hidden={!isSidebarOpen}
        className={cn(
          "z-50 flex w-56 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform duration-200 ease-out",
          "fixed inset-y-0 left-0 md:relative",
          isSidebarOpen
            ? "translate-x-0"
            : "-translate-x-full md:w-0 md:translate-x-0 md:overflow-hidden md:border-r-0",
        )}
      >
        {/* 品牌 */}
        <div className="flex h-12 shrink-0 items-center gap-2 border-b border-sidebar-border px-3">
          <Link
            href="/"
            className="flex min-w-0 items-center gap-2 rounded-[2px] focus-ring"
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
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-compact font-semibold leading-tight text-sidebar-foreground">
                MimirQ
              </span>
              <span className="truncate text-micro leading-tight text-muted-foreground">
                {t("brand.tagline")}
              </span>
            </span>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto size-11 shrink-0 rounded-[2px] hover:bg-info/10 hover:text-foreground md:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label={t("toolbar.sidebarClose")}
            title={t("toolbar.sidebarClose")}
          >
            <PanelLeftClose className="size-4" />
          </Button>
        </div>

        {/* 新对话 */}
        <div className="px-2 pt-2">
          <Button
            ref={firstActionRef}
            variant="ghost"
            className="h-11 w-full justify-start gap-2 rounded-[2px] px-2 text-compact font-medium text-sidebar-foreground shadow-none transition-colors hover:bg-info/10 hover:text-foreground md:h-8"
            onClick={() => {
              router.push("/");
              closeSidebarOnMobile();
            }}
          >
            <Plus className="size-4 shrink-0 text-info" />
            <span>{t("actions.newConversation")}</span>
          </Button>
        </div>

        {/* 导航菜单 */}
        {/* Allow internal scroll so items are never clipped on short viewports. */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-1 no-scrollbar">
          <div className="space-y-1.5">
            {visibleMenuSections.map((section, index) => {
              const isOpen = openSections[section.id] ?? false;
              const hasActiveItem = sectionHasActiveRoute(
                activeHref,
                section.items,
              );
              const ToggleIcon = isOpen ? ChevronDown : ChevronRight;

              return (
                <section
                  key={section.id}
                  className={cn(
                    index > 0 ? "border-t border-sidebar-border/70 pt-1.5" : "",
                  )}
                >
                  <button
                    type="button"
                    className={cn(
                      "flex min-h-11 w-full items-center justify-between gap-2 rounded-[2px] px-2 text-left transition-colors focus-ring md:min-h-7",
                      hasActiveItem
                        ? "text-foreground"
                        : "text-muted-foreground hover:bg-info/5 hover:text-foreground",
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
                    className={cn(
                      "grid overflow-hidden transition-[grid-template-rows] duration-200 ease-out",
                      isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                    )}
                  >
                    <div className="overflow-hidden">
                      <div className="space-y-0.5 pb-1">
                        {section.items.map((item) => {
                          const Icon = item.icon;
                          const isActive = activeHref === item.href;

                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              prefetch={false}
                              onClick={closeSidebarOnMobile}
                              aria-current={isActive ? "page" : undefined}
                              className={cn(
                                "relative flex min-h-11 items-center gap-2.5 rounded-[2px] px-2 text-compact transition-colors group focus-ring md:min-h-8",
                                "before:pointer-events-none before:absolute before:inset-y-1 before:left-0 before:w-0.5 before:rounded-[2px] before:transition-colors",
                                isActive
                                  ? "bg-info/10 font-semibold text-foreground before:bg-info"
                                  : "text-muted-foreground before:bg-transparent hover:bg-info/5 hover:text-foreground",
                              )}
                            >
                              <Icon
                                className={cn(
                                  "size-4 shrink-0",
                                  isActive
                                    ? "text-info"
                                    : "text-muted-foreground",
                                )}
                              />
                              <span className="truncate">
                                {t(item.labelKey)}
                              </span>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </section>
              );
            })}
          </div>
        </div>

        {/* 底部：账户与外观 */}
        <div className="shrink-0 border-t border-sidebar-border p-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label={
                isAuthenticated ? t("user.openSettings") : t("auth.goToLogin")
              }
              title={
                isAuthenticated ? t("user.openSettings") : t("auth.goToLogin")
              }
              className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-[2px] px-2 py-1 text-left transition-colors hover:bg-info/10 focus-ring md:min-h-10"
              onClick={() => {
                if (isAuthenticated) {
                  router.push(canOpenSettings ? "/settings" : "/");
                } else {
                  router.push("/auth");
                }
                closeSidebarOnMobile();
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
                  <span className="absolute -bottom-0.5 -right-0.5 size-2 rounded-full border border-sidebar-background bg-success" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-compact font-medium text-sidebar-foreground">
                  {userDisplayName}
                </span>
                <span className="block truncate text-micro leading-tight text-muted-foreground">
                  {userStatusLine}
                </span>
              </span>
            </button>
            <Button
              variant="ghost"
              size="icon"
              className="size-11 shrink-0 rounded-[2px] hover:bg-destructive/10 hover:text-destructive md:size-8"
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
            </Button>
          </div>

          <div className="mt-1 flex items-center gap-1 rounded-[2px] px-2">
            <span className="min-w-0 flex-1 truncate text-micro font-medium text-muted-foreground">
              {t("toolbar.appearance")}
            </span>
            <div className="shrink-0 [&_button]:size-11 [&_button]:rounded-[2px] md:[&_button]:size-8">
              <ModeToggle />
            </div>
          </div>
        </div>
      </nav>

      {/* 侧边栏折叠/展开按钮 */}
      {isSidebarOpen ? (
        <Button
          ref={toggleButtonRef}
          variant="ghost"
          size="icon"
          aria-controls="mimirq-sidebar"
          aria-expanded={true}
          aria-label={t("toolbar.collapse")}
          title={t("toolbar.collapse")}
          className={cn(
            "fixed bottom-3 left-56 z-50 hidden size-8 rounded-[2px] border border-border bg-background text-muted-foreground shadow-none transition-colors hover:bg-info/10 hover:text-foreground md:inline-flex",
            "supports-[padding:env(safe-area-inset-bottom)]:bottom-[calc(env(safe-area-inset-bottom)+0.75rem)]",
          )}
          onPointerDown={handleSidebarTogglePointerDown}
          onKeyDown={handleSidebarToggleKeyDown}
          onClick={handleSidebarToggle}
        >
          <PanelLeftClose className="size-4" />
        </Button>
      ) : (
        <div className="fixed left-0 top-0 z-50 h-12 w-12 md:top-1/2 md:h-8 md:w-8 md:-translate-y-1/2">
          <div className="group/sidebar-toggle relative h-full w-full">
            <Button
              ref={toggleButtonRef}
              variant="ghost"
              size="icon"
              aria-controls="mimirq-sidebar"
              aria-expanded={false}
              aria-label={t("toolbar.expand")}
              title={t("toolbar.expand")}
              className={cn(
                "absolute left-0 top-0.5 z-50 size-11 rounded-[2px] border border-border bg-background text-muted-foreground shadow-none transition-all duration-200 ease-out hover:bg-info/10 hover:text-foreground md:top-0 md:size-8 md:-translate-x-[120%] md:opacity-0 md:pointer-events-none",
                "md:group-hover/sidebar-toggle:translate-x-1 md:group-hover/sidebar-toggle:opacity-100 md:group-hover/sidebar-toggle:pointer-events-auto",
                "md:group-focus-within/sidebar-toggle:translate-x-1 md:group-focus-within/sidebar-toggle:opacity-100 md:group-focus-within/sidebar-toggle:pointer-events-auto",
                "focus-visible:translate-x-0 focus-visible:opacity-100 focus-visible:pointer-events-auto",
              )}
              onPointerDown={handleSidebarTogglePointerDown}
              onKeyDown={handleSidebarToggleKeyDown}
              onClick={handleSidebarToggle}
            >
              <PanelLeftOpen className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

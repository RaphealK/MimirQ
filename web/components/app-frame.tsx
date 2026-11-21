"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { AppFrameTopbar } from "@/components/app-frame-topbar";
import { Navbar } from "@/components/navbar";
import { AppBackground } from "@/components/ui/app-background";
import { useNavbarSidebar } from "@/hooks/use-navbar-sidebar";
import { cn } from "@/lib/utils";
import { useDocumentView } from "@/store/document-view";

type AppFrameProps = {
  children: React.ReactNode;
  className?: string;
  mainClassName?: string;
  rightPanel?: React.ReactNode;
  showBackground?: boolean;
  showNavbar?: boolean;
  withDocumentViewerPadding?: boolean;
};

export function AppFrame({
  children,
  className,
  mainClassName,
  rightPanel,
  showBackground = true,
  showNavbar = true,
  withDocumentViewerPadding = false,
}: Readonly<AppFrameProps>) {
  const t = useTranslations("Layout");
  const sidebar = useNavbarSidebar(showNavbar);
  const toggleButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const skipLinkRef = React.useRef<HTMLAnchorElement | null>(null);
  const appContentRef = React.useRef<HTMLDivElement | null>(null);
  const { isOpen: isDocPanelOpen } = useDocumentView();
  const docPanelPadding =
    withDocumentViewerPadding && isDocPanelOpen
      ? "mr-0 md:mr-[45vw] lg:mr-[40vw] xl:mr-[35vw]"
      : undefined;

  // Accessibility: when the sidebar acts like a modal overlay (mobile),
  // prevent focus/interaction with the rest of the app.
  React.useEffect(() => {
    if (!showNavbar) return;
    if (globalThis.window === undefined) return;

    const shouldInert = sidebar.isOverlay && sidebar.isDrawerOpen;

    const applyInert = (el: HTMLElement | null, inert: boolean) => {
      if (!el) return;
      try {
        (el as HTMLElement & { inert: boolean }).inert = inert;
      } catch {
        // ignore: inert not supported everywhere
      }
      if (inert) el.setAttribute("aria-hidden", "true");
      else el.removeAttribute("aria-hidden");
    };

    const skipEl = skipLinkRef.current;
    const contentEl = appContentRef.current;

    applyInert(skipEl, shouldInert);
    applyInert(contentEl, shouldInert);

    return () => {
      applyInert(skipEl, false);
      applyInert(contentEl, false);
    };
  }, [showNavbar, sidebar.isOverlay, sidebar.isDrawerOpen]);

  return (
    <div
      className={cn(
        "relative h-dvh overflow-hidden bg-background text-foreground",
        className,
      )}
    >
      <a
        ref={skipLinkRef}
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-60 focus:rounded-md focus:border focus:border-border focus:bg-background focus:px-3 focus:py-2 focus:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
      >
        {t("skipToMainContent")}
      </a>
      {showBackground && <AppBackground />}
      <div className="relative z-10 flex h-full overflow-hidden">
        {showNavbar && (
          <Navbar sidebar={sidebar} toggleButtonRef={toggleButtonRef} />
        )}
        <div
          ref={appContentRef}
          className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
        >
          {showNavbar && (
            <AppFrameTopbar
              sidebar={sidebar}
              toggleButtonRef={toggleButtonRef}
            />
          )}
          <div className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden">
            <main
              id="main-content"
              tabIndex={-1}
              className={cn(
                // Avoid animating layout properties like `margin` (baseline-ui).
                "flex-1 min-h-0 relative flex flex-col overflow-hidden",
                docPanelPadding,
                mainClassName,
              )}
            >
              {children}
            </main>
            {rightPanel}
          </div>
        </div>
      </div>
    </div>
  );
}

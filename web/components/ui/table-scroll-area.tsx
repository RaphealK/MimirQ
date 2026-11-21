"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

type TableScrollAreaProps = {
  children: ReactNode;
  label?: string;
  labelledBy?: string;
  className?: string;
  surface?: "background" | "surface";
};

export function TableScrollArea({
  children,
  label,
  labelledBy,
  className,
  surface = "background",
}: Readonly<TableScrollAreaProps>) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  const color = `hsl(var(--${surface}))`;

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const update = () => {
      const max = viewport.scrollWidth - viewport.clientWidth;
      const left = max > 1 && viewport.scrollLeft > 1;
      const right = max > 1 && viewport.scrollLeft < max - 1;
      setEdges((previous) =>
        previous.left === left && previous.right === right
          ? previous
          : { left, right },
      );
    };

    update();
    viewport.addEventListener("scroll", update, { passive: true });
    const observer =
      typeof ResizeObserver === "undefined"
        ? undefined
        : new ResizeObserver(update);
    observer?.observe(viewport);
    if (viewport.firstElementChild)
      observer?.observe(viewport.firstElementChild);
    if (!observer) window.addEventListener("resize", update);
    return () => {
      viewport.removeEventListener("scroll", update);
      observer?.disconnect();
      if (!observer) window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <div className={cn("relative min-w-0", className)}>
      {edges.left && (
        <div
          aria-hidden="true"
          data-scroll-edge="left"
          className="pointer-events-none absolute inset-y-0 left-0 z-20 w-6"
          style={{
            backgroundImage: `linear-gradient(to right, ${color}, transparent)`,
          }}
        />
      )}
      {edges.right && (
        <div
          aria-hidden="true"
          data-scroll-edge="right"
          className="pointer-events-none absolute inset-y-0 right-0 z-20 w-6"
          style={{
            backgroundImage: `linear-gradient(to left, ${color}, transparent)`,
          }}
        />
      )}
      <div
        ref={viewportRef}
        role={label || labelledBy ? "region" : undefined}
        aria-label={label}
        aria-labelledby={labelledBy}
        data-table-scroll="true"
        tabIndex={edges.left || edges.right ? 0 : undefined}
        className="w-full overflow-x-auto overscroll-x-contain focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/60"
        onKeyDown={(event) => {
          if (
            event.target !== event.currentTarget ||
            event.altKey ||
            event.ctrlKey ||
            event.metaKey
          )
            return;
          if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
          event.preventDefault();
          event.currentTarget.scrollBy({
            left: event.key === "ArrowRight" ? 96 : -96,
          });
        }}
      >
        {children}
      </div>
    </div>
  );
}

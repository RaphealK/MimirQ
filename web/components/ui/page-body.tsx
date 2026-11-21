import { cn } from "@/lib/utils";

type PageBodyProps = {
  children: React.ReactNode;
  className?: string;
  compact?: boolean;
  gutter?: "default" | "dense" | "none";
};

export function PageBody({
  children,
  className,
  gutter = "default",
}: Readonly<PageBodyProps>) {
  const gutterClass =
    gutter === "none" ? "px-0" : gutter === "dense" ? "px-4" : "px-6";

  return (
    <section
      data-page-scroll-container="true"
      className={cn(
        "flex-1 min-h-0 overflow-y-auto overscroll-contain pt-4 pb-8 custom-scrollbar",
        gutterClass,
        className,
      )}
    >
      {children}
    </section>
  );
}

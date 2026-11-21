import { cn } from "@/lib/utils";

type PageContainerProps = {
  children: React.ReactNode;
  className?: string;
  size?: "5xl" | "6xl" | "7xl" | "full";
};

/**
 * 6xl/7xl are capped at the engineering 1440px content width. `full` is for
 * workbench surfaces that intentionally span the viewport.
 */
const MAX_W: Record<NonNullable<PageContainerProps["size"]>, string> = {
  "5xl": "max-w-5xl",
  "6xl": "max-w-page",
  "7xl": "max-w-page",
  full: "max-w-none",
};

export function PageContainer({
  children,
  className,
  size = "6xl",
}: Readonly<PageContainerProps>) {
  return (
    <div className={cn("mx-auto w-full", MAX_W[size], className)}>
      {children}
    </div>
  );
}

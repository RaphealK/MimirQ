import { cn } from "@/lib/utils";

type StickyActionRailProps = {
  children: React.ReactNode;
  className?: string;
};

export function StickyActionRail({
  children,
  className,
}: Readonly<StickyActionRailProps>) {
  return (
    <div
      className={cn(
        "sticky bottom-0 z-20 mt-4 border-t border-border bg-surface px-3 py-2",
        className,
      )}
    >
      {children}
    </div>
  );
}

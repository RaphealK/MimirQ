import { cn } from "@/lib/utils";

type PageHeaderBarProps = {
  children: React.ReactNode;
  className?: string;
};

export function PageHeaderBar({
  children,
  className,
}: Readonly<PageHeaderBarProps>) {
  return (
    <div
      className={cn(
        // The AppFrame shell already offsets the top safe area once; adding the
        // inset here as well would double-pad every page toolbar.
        "sticky top-0 z-20 border-b border-border bg-surface",
        className,
      )}
    >
      {children}
    </div>
  );
}

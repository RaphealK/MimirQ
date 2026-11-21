import { StatStrip, type StatStripItem } from "@/components/ui/stat-strip";

export type SystemDataStripItem = StatStripItem;

type SystemDataStripProps = {
  items: readonly StatStripItem[];
  className?: string;
  minColumnWidth?: number;
};

/**
 * @deprecated Use StatStrip from `@/components/ui/stat-strip`.
 * Compatibility wrapper preserving the old hint/minColumnWidth contract.
 */
export function SystemDataStrip({
  items,
  className,
  minColumnWidth = 176,
}: Readonly<SystemDataStripProps>) {
  return (
    <StatStrip
      items={items}
      className={className}
      minColumnWidth={minColumnWidth}
    />
  );
}

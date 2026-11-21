import * as React from "react";

import { TableScrollArea } from "@/components/ui/table-scroll-area";
import { cn } from "@/lib/utils";

type DataTableProps = React.TableHTMLAttributes<HTMLTableElement>;

/**
 * Engineering table: 36px header, 40px rows, hairline rules, no zebra striping.
 * Row actions are revealed on hover/focus via `.data-table__actions`.
 */
export const DataTable = React.forwardRef<HTMLTableElement, DataTableProps>(
  function DataTable({ className, children, ...props }, ref) {
    return (
      <TableScrollArea
        label={props["aria-label"]}
        labelledBy={props["aria-labelledby"]}
      >
        <table
          ref={ref}
          data-slot="data-table"
          className={cn("data-table rounded-none", className)}
          {...props}
        >
          {children}
        </table>
      </TableScrollArea>
    );
  },
);
DataTable.displayName = "DataTable";

type DataTableRowProps = React.HTMLAttributes<HTMLTableRowElement> & {
  selected?: boolean;
  interactive?: boolean;
};

export const DataTableRow = React.forwardRef<
  HTMLTableRowElement,
  Readonly<DataTableRowProps>
>(function DataTableRow(
  {
    selected = false,
    interactive = true,
    className,
    onClick,
    onKeyDown,
    ...props
  },
  ref,
) {
  const isActionable = interactive && Boolean(onClick);

  return (
    <tr
      ref={ref}
      data-selected={selected ? "true" : undefined}
      tabIndex={isActionable ? 0 : undefined}
      className={cn(interactive && "cursor-pointer", className)}
      onClick={onClick}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.defaultPrevented) return;
        if (!isActionable) return;
        // Only the row itself activates on Enter/Space; inputs and action
        // buttons inside cells keep their native keyboard behaviour.
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          event.currentTarget.click();
        }
      }}
      {...props}
    />
  );
});
DataTableRow.displayName = "DataTableRow";

type DataTableCellProps = React.TdHTMLAttributes<HTMLTableCellElement> & {
  numeric?: boolean;
  name?: boolean;
};

export const DataTableCell = React.forwardRef<
  HTMLTableCellElement,
  Readonly<DataTableCellProps>
>(function DataTableCell(
  { numeric = false, name = false, className, ...props },
  ref,
) {
  return (
    <td
      ref={ref}
      className={cn(
        numeric && "data-table__num",
        name && "data-table__name",
        className,
      )}
      {...props}
    />
  );
});
DataTableCell.displayName = "DataTableCell";

type DataTableHeadCellProps = React.ThHTMLAttributes<HTMLTableCellElement> & {
  numeric?: boolean;
};

export const DataTableHeadCell = React.forwardRef<
  HTMLTableCellElement,
  Readonly<DataTableHeadCellProps>
>(function DataTableHeadCell({ numeric = false, className, ...props }, ref) {
  return (
    <th
      ref={ref}
      className={cn(numeric && "data-table__num", className)}
      {...props}
    />
  );
});
DataTableHeadCell.displayName = "DataTableHeadCell";

type DataTableActionsProps = React.TdHTMLAttributes<HTMLTableCellElement>;

export const DataTableActions = React.forwardRef<
  HTMLTableCellElement,
  Readonly<DataTableActionsProps>
>(function DataTableActions({ className, ...props }, ref) {
  return (
    <td ref={ref} className={cn("data-table__actions", className)} {...props} />
  );
});
DataTableActions.displayName = "DataTableActions";

type DataTableEmptyProps = {
  colSpan: number;
  children: React.ReactNode;
  className?: string;
};

export function DataTableEmpty({
  colSpan,
  children,
  className,
}: Readonly<DataTableEmptyProps>) {
  return (
    <tr>
      <td colSpan={colSpan} className={cn("data-table__empty", className)}>
        {children}
      </td>
    </tr>
  );
}

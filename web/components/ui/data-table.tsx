import * as React from "react";

import { cn } from "@/lib/utils";

type DataTableProps = React.TableHTMLAttributes<HTMLTableElement>;

/**
 * Engineering table: 36px header, 40px rows, hairline rules, no zebra striping.
 * Row actions are revealed on hover/focus via `.data-table__actions`.
 */
export function DataTable({
  className,
  children,
  ...props
}: Readonly<DataTableProps>) {
  return (
    <div className="w-full overflow-x-auto">
      <table
        data-slot="data-table"
        className={cn("data-table", className)}
        {...props}
      >
        {children}
      </table>
    </div>
  );
}

type DataTableRowProps = React.HTMLAttributes<HTMLTableRowElement> & {
  selected?: boolean;
  interactive?: boolean;
};

export function DataTableRow({
  selected = false,
  interactive = true,
  className,
  onClick,
  onKeyDown,
  ...props
}: Readonly<DataTableRowProps>) {
  return (
    <tr
      data-selected={selected ? "true" : undefined}
      tabIndex={interactive ? 0 : undefined}
      className={cn(interactive && "cursor-pointer", className)}
      onClick={onClick}
      onKeyDown={(event) => {
        if (
          interactive &&
          onClick &&
          (event.key === "Enter" || event.key === " ")
        ) {
          event.preventDefault();
          event.currentTarget.click();
        }
        onKeyDown?.(event);
      }}
      {...props}
    />
  );
}

type DataTableCellProps = React.TdHTMLAttributes<HTMLTableCellElement> & {
  numeric?: boolean;
  name?: boolean;
};

export function DataTableCell({
  numeric = false,
  name = false,
  className,
  ...props
}: Readonly<DataTableCellProps>) {
  return (
    <td
      className={cn(
        numeric && "data-table__num",
        name && "data-table__name",
        className,
      )}
      {...props}
    />
  );
}

type DataTableHeadCellProps = React.ThHTMLAttributes<HTMLTableCellElement> & {
  numeric?: boolean;
};

export function DataTableHeadCell({
  numeric = false,
  className,
  ...props
}: Readonly<DataTableHeadCellProps>) {
  return (
    <th className={cn(numeric && "data-table__num", className)} {...props} />
  );
}

type DataTableActionsProps = React.TdHTMLAttributes<HTMLTableCellElement>;

export function DataTableActions({
  className,
  ...props
}: Readonly<DataTableActionsProps>) {
  return <td className={cn("data-table__actions", className)} {...props} />;
}

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

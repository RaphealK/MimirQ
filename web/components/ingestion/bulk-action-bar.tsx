"use client";

import { useMemo, useState } from "react";
import { Download, RotateCcw, Trash2, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function BulkActionBar({
  selectionCount,
  canRetry,
  canCancel,
  canDelete,
  canExport,
  onClear,
  onRetry,
  onCancel,
  onDelete,
  onExport,
}: Readonly<{
  selectionCount: number;
  canRetry: boolean;
  canCancel: boolean;
  canDelete: boolean;
  canExport: boolean;
  onClear: () => void;
  onRetry: () => void;
  onCancel: () => void;
  onDelete: () => Promise<void> | void;
  onExport: () => void;
}>) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmValue, setDeleteConfirmValue] = useState("");
  const deleteEnabled = useMemo(
    () => canDelete && deleteConfirmValue === String(selectionCount),
    [canDelete, deleteConfirmValue, selectionCount],
  );

  return (
    <>
      <div
        role="toolbar"
        aria-label="批量操作"
        className="rounded-[6px] border border-border bg-surface px-3 py-3"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="inline-flex h-8 min-w-8 items-center justify-center rounded-[4px] border border-border bg-muted px-2 font-code text-body font-semibold tabular-nums text-foreground">
              {selectionCount}
            </div>
            <div className="min-w-0">
              <div className="text-micro font-semibold uppercase tracking-[0.18em] text-subtle-foreground">
                批量操作
              </div>
              <div className="mt-0.5 text-compact font-medium tracking-[-0.01em] text-foreground">
                选中 {selectionCount} 项
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 rounded-[4px] px-3 text-caption text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={onClear}
          >
            清空
          </Button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <ActionTile
            icon={RotateCcw}
            label="Retry"
            tone="sky"
            disabled={!canRetry}
            onClick={onRetry}
          />
          <ActionTile
            icon={XCircle}
            label="Cancel"
            tone="amber"
            disabled={!canCancel}
            onClick={onCancel}
          />
          <ActionTile
            icon={Trash2}
            label="Delete"
            tone="rose"
            disabled={!canDelete}
            onClick={() => setDeleteOpen(true)}
          />
          <ActionTile
            icon={Download}
            label="Export"
            tone="emerald"
            disabled={!canExport}
            onClick={onExport}
          />
        </div>
      </div>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除选中的入库任务</DialogTitle>
            <DialogDescription>
              请输入数字 {selectionCount} 以确认删除。这会移除选中的任务记录。
            </DialogDescription>
          </DialogHeader>
          <Input
            value={deleteConfirmValue}
            onChange={(event) => setDeleteConfirmValue(event.target.value)}
            inputMode="numeric"
            placeholder={`输入 ${selectionCount}`}
          />
          <DialogFooter className="mt-4 gap-2">
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
              取消
            </Button>
            <Button
              variant="destructive"
              disabled={!deleteEnabled}
              onClick={async () => {
                await onDelete();
                setDeleteConfirmValue("");
                setDeleteOpen(false);
              }}
            >
              Confirm Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ActionTile({
  icon: Icon,
  label,
  tone,
  disabled,
  onClick,
}: Readonly<{
  icon: typeof RotateCcw;
  label: string;
  tone: "sky" | "amber" | "rose" | "emerald";
  disabled: boolean;
  onClick: () => void;
}>) {
  const toneClass = {
    sky: "border-border bg-surface text-foreground hover:bg-muted",
    amber: "border-border bg-surface text-foreground hover:bg-muted",
    rose: "border-destructive/30 bg-destructive/5 text-destructive hover:bg-destructive/10",
    emerald: "border-border bg-surface text-foreground hover:bg-muted",
  }[tone];

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "h-8 justify-start gap-2 rounded-[4px] border px-3 text-micro font-medium tracking-[0.01em] transition-colors duration-120 disabled:opacity-40",
        toneClass,
      )}
    >
      <span className="inline-flex size-6 items-center justify-center rounded-[4px] bg-muted text-muted-foreground">
        <Icon className="size-3.5" />
      </span>
      {label}
    </Button>
  );
}

"use client";

import { KnowledgeInspector } from "@/components/knowledge/knowledge-inspector";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { Document } from "@/types";

type KnowledgeDocumentDrawerProps = {
  doc: Document | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenOriginal?: (doc: Document) => void;
  onAfterClose?: () => void;
};

/**
 * Single right-side detail drawer for the knowledge documents surface.
 * The page mounts this component exactly once; rows only change `doc`.
 */
export function KnowledgeDocumentDrawer({
  doc,
  open,
  onOpenChange,
  onOpenOriginal,
  onAfterClose,
}: Readonly<KnowledgeDocumentDrawerProps>) {
  return (
    <Sheet open={open && Boolean(doc)} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        overlayClassName="bg-transparent"
        className="flex w-[min(520px,100vw)] flex-col gap-0 border-l border-border bg-background p-0 shadow-none sm:max-w-[520px]"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onAfterClose?.();
        }}
      >
        <SheetHeader className="border-b border-border px-4 py-3 text-left">
          <SheetTitle className="text-title-sm">文档详情</SheetTitle>
          <SheetDescription className="text-caption text-muted-foreground">
            管理切片、来源与健康入口，不挤占主表格宽度。
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-hidden">
          <KnowledgeInspector
            embedded
            selectedDocs={doc ? [doc] : []}
            onOpenOriginal={onOpenOriginal}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}

import type { LucideIcon } from "lucide-react";
import {
  File,
  FileCode,
  FileSpreadsheet,
  FileText,
  FileType,
  Presentation,
} from "lucide-react";

import type { Document } from "@/types";

export type FileTypeMeta = {
  icon: LucideIcon;
  label: string;
  color: string;
  bg: string;
  border: string;
};

const icons = new Map<string, LucideIcon>([
  ["pdf", FileText],
  ["txt", FileText],
  ["doc", FileType],
  ["docx", FileType],
  ["ppt", Presentation],
  ["pptx", Presentation],
  ["csv", FileSpreadsheet],
  ["xls", FileSpreadsheet],
  ["xlsx", FileSpreadsheet],
  ["md", FileCode],
  ["html", FileCode],
  ["htm", FileCode],
  ["json", FileCode],
]);

export function getFileTypeMeta(
  doc: Pick<Document, "filename" | "file_type">,
): FileTypeMeta {
  const explicit = String(doc.file_type || "")
    .trim()
    .toLowerCase();
  const extension =
    explicit ||
    String(doc.filename || "")
      .trim()
      .split(".")
      .pop()
      ?.toLowerCase()
      .trim() ||
    "";

  return {
    icon: icons.get(extension) ?? File,
    label: extension === "htm" ? "HTML" : extension.toUpperCase() || "FILE",
    color: "text-muted-foreground",
    bg: "bg-muted",
    border: "border-border",
  };
}

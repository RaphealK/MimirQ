import {
  Activity,
  Archive,
  BookOpen,
  Braces,
  ChartColumn,
  CheckCheck,
  ClipboardList,
  Database,
  FileOutput,
  FileSearch,
  FileText,
  Gauge,
  History,
  KeyRound,
  Layers,
  Library,
  ListChecks,
  MessageSquare,
  Network,
  ScanLine,
  Settings,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Upload,
  Users,
  Workflow,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

const pageIcons = {
  "access-review": ShieldCheck,
  "audit-log": ClipboardList,
  chat: MessageSquare,
  "chunk-preview": Layers,
  "data-governance": ShieldCheck,
  dataset: Database,
  diagnostics: Activity,
  "feedback-quality": CheckCheck,
  "governance-config": Settings2,
  "group-management": Users,
  "ingestion-monitor": ListChecks,
  "ingestion-operation": Upload,
  "kg-retrieval-evaluation": FileSearch,
  "kg-snapshot": Archive,
  "knowledge-base": BookOpen,
  "knowledge-graph": Network,
  "knowledge-management": Library,
  "members-rbac": KeyRound,
  parsing: ScanLine,
  "profile-discovery": ChartColumn,
  prompts: Braces,
  "qa-history": History,
  "quarantine-queue": ShieldAlert,
  "rag-visualization": Workflow,
  "ragas-evaluation": ClipboardList,
  "report-export": FileOutput,
  "retrieval-ablation": SlidersHorizontal,
  settings: Settings,
  "usage-quota": Gauge,
} satisfies Record<string, LucideIcon>;

export type PageTitleIconName = keyof typeof pageIcons;
export const PAGE_TITLE_ICON_NAMES = Object.keys(
  pageIcons,
) as PageTitleIconName[];

type PageTitleIconProps = {
  name: PageTitleIconName;
  compact?: boolean;
  className?: string;
};

export function PageTitleIcon({
  name,
  compact = true,
  className,
}: Readonly<PageTitleIconProps>) {
  const Icon = pageIcons[name] ?? FileText;
  return (
    <Icon
      aria-hidden="true"
      data-theme-illustration="page-title"
      data-page-icon={name}
      strokeWidth={1.6}
      className={cn(
        "pointer-events-none shrink-0 text-foreground",
        compact ? "size-6" : "size-8",
        className,
      )}
    />
  );
}

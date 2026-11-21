export const analysisPageTokens = {
  pageSurface: "bg-background",
  headerWrap: "border border-border bg-surface",
  workbenchSurface: "border border-border bg-surface",
  card: "border border-border bg-surface shadow-none",
  cardMuted: "border border-border bg-raised shadow-none",
  divider: "border-border",
} as const;

export const analysisTypographyTokens = {
  title: "text-compact font-semibold text-foreground",
  section: "text-caption font-semibold text-foreground",
  body: "text-caption leading-[1.45] text-muted-foreground",
  subtle: "text-micro leading-4 text-subtle-foreground",
  label: "text-micro font-medium uppercase text-subtle-foreground",
  mono: "font-mono text-micro leading-4 tabular-nums text-foreground",
} as const;

export const analysisDenseControls = {
  primaryButton: "h-11 gap-1.5 px-3 text-caption font-medium sm:h-8",
  outlineButton:
    "h-11 gap-1.5 border-border bg-transparent px-3 text-caption font-medium sm:h-8",
  inlineButton:
    "h-11 gap-1 border-border bg-transparent px-2 text-micro font-medium sm:h-7",
  input: "h-11 border-border bg-background text-caption sm:h-8",
  select: "h-11 border-border bg-background text-caption sm:h-8",
  iconButton: "size-11 sm:size-8",
} as const;

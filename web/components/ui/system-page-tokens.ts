export const systemPageTokens = {
  heading: "text-[13px] font-semibold tracking-[-0.01em] text-foreground",
  body: "text-[12px] leading-[1.45] text-muted-foreground",
  subtle: "text-[11px] leading-4 text-subtle-foreground",
  microLabel:
    "text-[11px] font-semibold uppercase tracking-[0.06em] text-subtle-foreground",
  monoMeta: "font-mono text-[11px] leading-4 text-subtle-foreground",
  tableHead:
    "text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle-foreground",
} as const;

export const systemDenseControls = {
  outlineButton:
    "h-8 gap-1.5 rounded-md border-border bg-transparent px-3 text-xs font-semibold",
  primaryButton: "h-8 gap-1.5 rounded-md px-3 text-xs font-semibold",
  inlineAction:
    "h-7 gap-1 rounded-md border-border bg-transparent px-2 text-[11px] font-semibold",
  input: "h-9 rounded-md border-border bg-background text-[12px]",
  selectTrigger: "h-9 rounded-md border-border bg-background text-[12px]",
  iconGhost: "h-8 w-8 rounded-md",
} as const;

export const systemWorkbenchTokens = {
  panel: "rounded-lg border border-border bg-surface shadow-none",
  panelMuted: "rounded-lg border border-border bg-raised shadow-none",
  divider: "border-border",
} as const;

export const settingsTextTokens = {
  sectionTitle: "text-[15px] font-semibold tracking-[-0.01em] text-foreground",
  sectionIcon: "h-4 w-4 text-foreground",
  sectionBadge:
    "rounded-full border border-border bg-raised px-2 py-0.5 text-[11px] font-semibold text-muted-foreground",
  panelTitle: "text-[12px] font-semibold tracking-[-0.005em] text-foreground",
  panelTitleIcon: "h-4 w-4 text-muted-foreground",
  fieldLabel: "text-[11px] font-semibold text-muted-foreground",
  helpText: "text-[11.5px] leading-[18px] text-muted-foreground",
  microText: "text-[10.5px] leading-4 text-subtle-foreground",
  valueText: "text-foreground",
} as const;

export const analysisPageTokens = {
  pageSurface: 'bg-background',
  headerWrap: 'border border-border bg-background',
  workbenchSurface: 'border border-border bg-background',
  card: 'border border-border bg-background shadow-none',
  cardMuted: 'border border-border bg-muted/20 shadow-none',
  divider: 'border-border',
} as const

export const analysisTypographyTokens = {
  title: 'text-compact font-semibold text-foreground',
  section: 'text-caption font-semibold text-foreground',
  body: 'text-caption leading-[1.45] text-muted-foreground',
  subtle: 'text-micro leading-4 text-muted-foreground',
  label: 'text-micro font-medium uppercase text-muted-foreground',
  mono: 'font-mono text-micro leading-4 tabular-nums text-foreground',
} as const

export const analysisDenseControls = {
  primaryButton: 'h-11 gap-1.5 px-3 text-caption font-medium sm:h-8',
  outlineButton: 'h-11 gap-1.5 border-control bg-background px-3 text-caption font-medium sm:h-8',
  inlineButton: 'h-11 gap-1 border-border bg-background px-2 text-micro font-medium sm:h-7',
  input: 'h-11 border-control bg-background text-caption sm:h-8',
  select: 'h-11 border-control bg-background text-caption sm:h-8',
  iconButton: 'size-11 sm:size-8',
} as const

'use client'

import type { CSSProperties } from 'react'
import { useTheme } from 'next-themes'
import { Toaster } from 'sonner'

// Neutral toast surface; variant classes only tint the border and icon.
const TOAST_CSS_VARS = {
  '--normal-bg': 'hsl(var(--popover))',
  '--normal-border': 'hsl(var(--border))',
  '--normal-text': 'hsl(var(--popover-foreground))',
  '--success-bg': 'hsl(var(--popover))',
  '--success-border': 'hsl(var(--success) / 0.4)',
  '--success-text': 'hsl(var(--success))',
  '--info-bg': 'hsl(var(--popover))',
  '--info-border': 'hsl(var(--border))',
  '--info-text': 'hsl(var(--popover-foreground))',
  '--warning-bg': 'hsl(var(--popover))',
  '--warning-border': 'hsl(var(--warning) / 0.4)',
  '--warning-text': 'hsl(var(--warning))',
  '--error-bg': 'hsl(var(--popover))',
  '--error-border': 'hsl(var(--destructive) / 0.4)',
  '--error-text': 'hsl(var(--destructive))',
  '--border-radius': '6px',
} as CSSProperties

export function SonnerToaster() {
  const { theme, systemTheme } = useTheme()
  const resolvedTheme = theme === 'system' ? systemTheme : theme
  const sonnerTheme = resolvedTheme === 'dark' ? 'dark' : 'light'

  return (
    <Toaster
      theme={sonnerTheme}
      position="top-right"
      closeButton
      gap={6}
      style={TOAST_CSS_VARS}
      toastOptions={{
        className: 'border-border shadow-strong',
        classNames: {
          toast: 'border-border',
          title: 'text-foreground',
          description: 'text-muted-foreground',
          default: '!border-border [&_[data-icon]]:!text-foreground',
          info: '!border-border [&_[data-icon]]:!text-foreground',
          success: '!border-success/40 [&_[data-icon]]:!text-success',
          warning: '!border-warning/40 [&_[data-icon]]:!text-warning',
          error: '!border-destructive/40 [&_[data-icon]]:!text-destructive',
        },
      }}
    />
  )
}

"use client";

import type { CSSProperties } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";

/**
 * Monochrome syntax theme: every token resolves to the grey ramp, so code
 * blocks stay inside the black/white design and only status UI carries hue.
 */
const monochromeCodeStyle: Record<string, CSSProperties> = {
  'code[class*="language-"]': {
    color: "hsl(var(--foreground))",
    background: "none",
    fontFamily: "var(--font-code)",
    fontSize: "0.85em",
    textShadow: "none",
  },
  'pre[class*="language-"]': {
    color: "hsl(var(--foreground))",
    background: "transparent",
    margin: 0,
    padding: 0,
    overflow: "auto",
    textShadow: "none",
  },
  comment: { color: "hsl(var(--subtle-foreground))", fontStyle: "italic" },
  prolog: { color: "hsl(var(--subtle-foreground))" },
  doctype: { color: "hsl(var(--subtle-foreground))" },
  cdata: { color: "hsl(var(--subtle-foreground))" },
  punctuation: { color: "hsl(var(--muted-foreground))" },
  namespace: { opacity: 0.7 },
  property: { color: "hsl(var(--foreground))" },
  tag: { color: "hsl(var(--foreground))" },
  boolean: { color: "hsl(var(--foreground))" },
  number: { color: "hsl(var(--foreground))" },
  constant: { color: "hsl(var(--foreground))" },
  symbol: { color: "hsl(var(--foreground))" },
  deleted: { color: "hsl(var(--foreground))" },
  selector: { color: "hsl(var(--muted-foreground))" },
  "attr-name": { color: "hsl(var(--muted-foreground))" },
  string: { color: "hsl(var(--muted-foreground))" },
  char: { color: "hsl(var(--muted-foreground))" },
  builtin: { color: "hsl(var(--muted-foreground))" },
  inserted: { color: "hsl(var(--muted-foreground))" },
  operator: { color: "hsl(var(--muted-foreground))" },
  entity: { color: "hsl(var(--muted-foreground))" },
  url: { color: "hsl(var(--muted-foreground))" },
  variable: { color: "hsl(var(--foreground))" },
  atrule: { color: "hsl(var(--foreground))", fontWeight: 500 },
  "attr-value": { color: "hsl(var(--muted-foreground))" },
  "class-name": { color: "hsl(var(--foreground))" },
  function: { color: "hsl(var(--foreground))" },
  keyword: { color: "hsl(var(--foreground))", fontWeight: 500 },
  regex: { color: "hsl(var(--muted-foreground))" },
  important: { color: "hsl(var(--foreground))", fontWeight: 600 },
  bold: { fontWeight: 600 },
  italic: { fontStyle: "italic" },
};

type CinematicCodeBlockProps = Readonly<{
  language: string;
  code: string;
}>;

export function CinematicCodeBlock({
  language,
  code,
}: CinematicCodeBlockProps) {
  return (
    <div className="relative group rounded-lg overflow-hidden my-4 border border-border bg-raised shadow-none motion-safe:animate-fade-in">
      <div className="flex items-center px-4 py-2 bg-surface border-b border-border">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-border-strong" />
          <div className="w-2.5 h-2.5 rounded-full bg-border-strong/70" />
          <div className="w-2.5 h-2.5 rounded-full bg-border-strong/40" />
        </div>
        <span className="ml-4 text-[11px] font-mono text-subtle-foreground uppercase">
          {language}
        </span>
      </div>
      <SyntaxHighlighter
        style={monochromeCodeStyle}
        language={language}
        PreTag="div"
        customStyle={{
          margin: 0,
          borderRadius: 0,
          background: "transparent",
          fontSize: "0.85em",
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

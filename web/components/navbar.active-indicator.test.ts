// Source contract check only; this is not behavior coverage.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("navbar active route indicator", () => {
  it("uses the selected surface and a 2px signal-blue rail", () => {
    const src = fs.readFileSync(path.resolve(__dirname, "navbar.tsx"), "utf8");
    expect(src).toContain('"bg-selected font-semibold text-foreground before:bg-primary"');
    expect(src).toContain("before:w-0.5");
    expect(src).not.toContain("before:bg-info");
    expect(src).not.toMatch(/\b(?:bg|text|border|before:bg)-info\b/);
    expect(src).not.toContain("bg-[linear-gradient");
  });
});

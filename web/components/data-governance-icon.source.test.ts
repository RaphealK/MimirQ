import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("data governance icon", () => {
  it("uses the same semantic SVG in the page title and empty intake state", () => {
    const panel = fs.readFileSync(
      path.resolve(__dirname, "data-governance-panel.tsx"),
      "utf8",
    );
    expect(panel).toContain('iconImage="data-governance"');
    expect(panel).toMatch(/<PageTitleIcon\s+name="data-governance"/);
    expect(panel).not.toContain('src="/page-title-icons/data-governance.png"');
  });
});

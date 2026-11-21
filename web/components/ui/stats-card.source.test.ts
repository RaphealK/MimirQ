// Source contract check only; this is not behavior coverage.
import fs from "node:fs";
import path from "node:path";

import { describe, it } from "vitest";
import {
  expectSourceNotToContain,
  expectSourceToContain,
} from "@/lib/source-test-utils";

describe("stats card visual boundary contract", () => {
  it("keeps stat cards structural and monochrome instead of gradient glass tiles", () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, "stats-card.tsx"),
      "utf8",
    );

    expectSourceToContain(
      src,
      'const silentColorStyle = "border-border bg-raised text-muted-foreground"',
    );
    expectSourceToContain(
      src,
      '"group relative overflow-hidden transition-all duration-200", "flex items-center gap-4 rounded-xl border border-border bg-surface px-5 py-4 shadow-none hover:border-border-strong"',
    );
    expectSourceToContain(src, "border-border bg-surface text-foreground");
    expectSourceNotToContain(src, "linear-gradient");
    expectSourceNotToContain(src, "backdrop-blur-sm");
    expectSourceNotToContain(src, "hover:scale-[1.02]");
  });
});

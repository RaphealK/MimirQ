import { describe, expect, it } from "vitest";

import {
  formatCitationRankScore,
  formatCitationScore,
  isUsableScore,
  toFiniteScore,
} from "./citation-score";

describe("citation score formatting", () => {
  it("keeps missing scores missing instead of coercing null to zero", () => {
    expect(toFiniteScore(null)).toBeNull();
    expect(toFiniteScore(undefined)).toBeNull();
    expect(toFiniteScore("")).toBeNull();
    expect(formatCitationRankScore(null)).toBe("—");
    expect(formatCitationScore(undefined)).toBe("—");
  });

  it("keeps a real zero as a valid score", () => {
    expect(toFiniteScore(0)).toBe(0);
    expect(formatCitationRankScore(0)).toBe("0.00");
    expect(formatCitationScore(0)).toBe("0%");
    expect(isUsableScore(0)).toBe(false);
  });

  it("formats normalized and raw scores from the citation contract", () => {
    expect(formatCitationRankScore(0.83)).toBe("0.83");
    expect(formatCitationScore(0.83)).toBe("83%");
    expect(formatCitationRankScore(1.2)).toBe("1.200");
    expect(formatCitationScore("0.5")).toBe("50%");
    expect(formatCitationRankScore(Number.NaN)).toBe("—");
  });
});

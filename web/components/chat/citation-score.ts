/**
 * Citation score formatting shared by the chat message surfaces.
 *
 * Missing scores must stay missing (`—`), while a real zero is a valid score.
 */
export function toFiniteScore(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value !== "number" && typeof value !== "string") return null;
  const score = Number(value);
  return Number.isFinite(score) ? score : null;
}

export function formatCitationScore(value: unknown): string {
  const score = toFiniteScore(value);
  if (score == null) return "—";
  if (score >= 0 && score <= 1) return `${Math.round(score * 100)}%`;
  return score.toFixed(3);
}

export function formatCitationRankScore(value: unknown): string {
  const score = toFiniteScore(value);
  if (score == null) return "—";
  if (score >= 0 && score <= 1) return score.toFixed(2);
  return score.toFixed(3);
}

export function isUsableScore(value: unknown): boolean {
  const score = toFiniteScore(value);
  return score != null && score > 0;
}

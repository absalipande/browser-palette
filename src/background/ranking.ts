import type { HistoryEntry } from "../types";

export function scoreHistoryEntry(entry: HistoryEntry, query: string) {
  const textScore = query ? scoreText(entry, query) : 0;
  const behaviorScore = recencyScore(entry.lastVisitedAt) + frequencyScore(entry.visitCount);

  if (!query) {
    return behaviorScore;
  }

  if (textScore === 0) {
    return 0;
  }

  return textScore + behaviorScore;
}

function scoreText(entry: HistoryEntry, query: string) {
  const title = entry.title.toLowerCase();
  const hostname = entry.hostname.toLowerCase();
  const displayUrl = entry.displayUrl.toLowerCase();
  let score = 0;

  if (hostname === query || hostname === `${query}.com`) score += 70;
  if (hostname.startsWith(query)) score += 48;
  if (title === query) score += 44;
  if (title.startsWith(query)) score += 32;
  if (displayUrl.startsWith(query)) score += 30;
  if (hostname.includes(query)) score += 24;
  if (title.includes(query)) score += 18;
  if (displayUrl.includes(query)) score += 14;

  return score;
}

function recencyScore(lastVisitedAt: number) {
  const ageHours = (Date.now() - lastVisitedAt) / (60 * 60 * 1000);
  return Math.max(0, 18 / (1 + ageHours / 24));
}

function frequencyScore(visitCount: number) {
  return Math.log(visitCount + 1) * 8;
}

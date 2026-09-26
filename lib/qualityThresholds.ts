/**
 * Configurable quality thresholds per genre and feedback loop to improve quality
 * check thresholds from admin overrides (#431, #448).
 *
 * Part of the AI Song Quality Filter (Mastra AI + NVIDIA):
 * Different music genres possess distinct acoustic dynamics, production conventions,
 * and baseline quality expectations (e.g. Classical requires high dynamic clarity,
 * while Lofi accepts ambient noise and vintage distortion). This module provides
 * configurable, genre-aware thresholds and aggregates admin overrides into concrete
 * threshold adjustments per genre and platform-wide.
 *
 * - Admins frequently approve tracks the filter rejected → the confidence
 *   bar is too strict; recommend lowering it.
 * - Admins frequently reject tracks the filter approved → the bar is too
 *   loose; recommend raising it.
 * - Overrides are otherwise in line with the filter → keep the bar as is.
 *
 * The store is bounded (oldest entries evicted past the cap) so an unbounded
 * admin session can never grow it without limit.
 */

export type FilterDecision = 'approved' | 'rejected' | 'timeout';
export type AdminAction = 'approved' | 'rejected' | 'skipped';

export interface AdminOverride {
  /** Track the override was applied to. */
  trackId: string;
  /** What the automated filter decided. */
  filterDecision: FilterDecision;
  /** What the admin decided instead. */
  adminAction: AdminAction;
  /** Optional genre of the track. */
  genre?: string;
}

export interface ThresholdFeedback {
  overridesRecorded: number;
  /** Filter said reject (or timed out), admin said approve. */
  approvalReversals: number;
  /** Filter said approve, admin said reject. */
  rejectionReversals: number;
  /** Filter timed out and the admin skipped instead. */
  timeoutSkips: number;
  /** Recommended `minConfidenceScore` after weighing the overrides. */
  suggestedMinConfidenceScore: number;
  /** Human-readable summary of the recommendation. */
  recommendation: string;
}

/** Baseline confidence the filter uses to approve a track. */
export const BASE_MIN_CONFIDENCE_SCORE = 0.7;

/** Minimum adjustment per feedback cycle, in confidence points. */
export const THRESHOLD_STEP = 0.05;

/** Share of overrides that must disagree before a threshold moves. */
export const REVERSAL_SHARE = 0.3;

/** Default quality thresholds mapped by normalized genre name. */
export const DEFAULT_GENRE_THRESHOLDS: Readonly<Record<string, number>> = {
  classical: 0.85,
  jazz: 0.8,
  acoustic: 0.78,
  electronic: 0.75,
  rnb: 0.72,
  pop: 0.7,
  rock: 0.7,
  'hip hop': 0.7,
  metal: 0.68,
  ambient: 0.65,
  lofi: 0.6,
  default: BASE_MIN_CONFIDENCE_SCORE,
};

const MAX_OVERRIDES = 1000;

const overrides: AdminOverride[] = [];
const genreThresholds: Record<string, number> = { ...DEFAULT_GENRE_THRESHOLDS };

/** Normalizes genre string to lowercase trimmed key. */
export function normalizeGenreKey(genre?: string): string {
  if (!genre || typeof genre !== 'string') return 'default';
  const clean = genre.trim().toLowerCase();
  return clean || 'default';
}

/**
 * Returns the configurable quality threshold for a given genre.
 * Falls back to default/baseline if genre is unset or unconfigured.
 */
export function getGenreThreshold(genre?: string): number {
  const key = normalizeGenreKey(genre);
  if (key in genreThresholds) {
    return genreThresholds[key];
  }
  return genreThresholds.default ?? BASE_MIN_CONFIDENCE_SCORE;
}

/**
 * Sets or overrides the quality threshold for a specific genre.
 * The value is clamped to [0, 1] and rounded to THRESHOLD_STEP.
 */
export function setGenreThreshold(genre: string, threshold: number): void {
  const key = normalizeGenreKey(genre);
  const clamped = Math.min(
    1,
    Math.max(0, Number.isFinite(threshold) ? threshold : BASE_MIN_CONFIDENCE_SCORE)
  );
  genreThresholds[key] = roundToStep(clamped);
}

/**
 * Batch updates genre thresholds.
 */
export function setGenreThresholds(thresholds: Record<string, number>): void {
  if (!thresholds || typeof thresholds !== 'object') return;
  for (const [g, t] of Object.entries(thresholds)) {
    if (typeof t === 'number') {
      setGenreThreshold(g, t);
    }
  }
}

/**
 * Returns all currently configured genre thresholds.
 */
export function getGenreThresholds(): Record<string, number> {
  return { ...genreThresholds };
}

/**
 * Resets all genre thresholds back to defaults.
 */
export function resetGenreThresholds(): void {
  for (const k of Object.keys(genreThresholds)) {
    delete genreThresholds[k];
  }
  Object.assign(genreThresholds, DEFAULT_GENRE_THRESHOLDS);
}

/**
 * Evaluates whether a raw score (0–100 or 0–1) meets the genre threshold.
 */
export function evaluateQualityScoreAgainstGenre(
  score: number,
  genre?: string
): { passed: boolean; requiredThreshold: number; scoreNormalized: number; genre: string } {
  const normScore = score > 1 ? score / 100 : score;
  const threshold = getGenreThreshold(genre);
  const normalizedGenre = genre && genre.trim() ? genre.trim() : 'Default';
  return {
    passed: normScore >= threshold,
    requiredThreshold: threshold,
    scoreNormalized: normScore,
    genre: normalizedGenre,
  };
}

/** Record one admin override for the feedback loop. */
export function recordAdminOverride(override: AdminOverride): void {
  if (overrides.length >= MAX_OVERRIDES) {
    overrides.shift();
  }
  overrides.push(override);
}

/**
 * Aggregate the recorded overrides into a threshold recommendation.
 * Optionally filtered by genre to tune specific genre bars.
 */
export function getThresholdFeedback(genre?: string): ThresholdFeedback {
  const targetKey = genre ? normalizeGenreKey(genre) : undefined;
  const filteredOverrides = targetKey
    ? overrides.filter((o) => normalizeGenreKey(o.genre) === targetKey)
    : overrides;

  let approvalReversals = 0;
  let rejectionReversals = 0;
  let timeoutSkips = 0;

  for (const override of filteredOverrides) {
    if (override.filterDecision === 'timeout' && override.adminAction === 'skipped') {
      timeoutSkips += 1;
      continue;
    }
    if (override.filterDecision !== 'approved' && override.adminAction === 'approved') {
      approvalReversals += 1;
    } else if (override.filterDecision === 'approved' && override.adminAction === 'rejected') {
      rejectionReversals += 1;
    }
  }

  const baseThreshold = genre ? getGenreThreshold(genre) : BASE_MIN_CONFIDENCE_SCORE;
  let suggestedMinConfidenceScore = baseThreshold;
  let recommendation = genre
    ? `Admin overrides agree with the filter for genre "${genre}" — keep the current threshold.`
    : 'Admin overrides agree with the filter — keep the current threshold.';

  const disagreements = approvalReversals + rejectionReversals;
  if (filteredOverrides.length > 0 && disagreements / filteredOverrides.length >= REVERSAL_SHARE) {
    if (approvalReversals > rejectionReversals) {
      suggestedMinConfidenceScore = roundToStep(Math.max(0, baseThreshold - THRESHOLD_STEP));
      recommendation = genre
        ? `Admins frequently approve "${genre}" tracks the filter rejects — lower minConfidenceScore.`
        : 'Admins frequently approve tracks the filter rejects — lower minConfidenceScore.';
    } else if (rejectionReversals > approvalReversals) {
      suggestedMinConfidenceScore = roundToStep(Math.min(1, baseThreshold + THRESHOLD_STEP));
      recommendation = genre
        ? `Admins frequently reject "${genre}" tracks the filter approves — raise minConfidenceScore.`
        : 'Admins frequently reject tracks the filter approves — raise minConfidenceScore.';
    }
  }

  return {
    overridesRecorded: filteredOverrides.length,
    approvalReversals,
    rejectionReversals,
    timeoutSkips,
    suggestedMinConfidenceScore,
    recommendation,
  };
}

/** Clear the feedback store and reset genre thresholds (test use only). */
export function resetThresholdFeedback(): void {
  overrides.length = 0;
  resetGenreThresholds();
}

function roundToStep(value: number): number {
  // Snap through a fixed decimal string so IEEE-754 drift
  // (e.g. 14 * 0.05 === 0.7000000000000001) can never leak into a suggestion.
  return Number((Math.round(value / THRESHOLD_STEP) * THRESHOLD_STEP).toFixed(2));
}

'use client';

import React from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  Music2,
  Info,
} from 'lucide-react';
import QualityBadge from './QualityBadge';
import { cn } from '@/lib/utils';
import type { UploadQualityPipelineResult } from '@/lib/uploadQualityPipeline';

interface UploadQualityFeedbackProps {
  result: UploadQualityPipelineResult;
  title?: string;
  artist?: string;
  onPublish?: () => void;
  onRetry?: () => void;
  onRequestManualReview?: () => void;
  className?: string;
}

export default function UploadQualityFeedback({
  result,
  title,
  artist,
  onPublish,
  onRetry,
  onRequestManualReview,
  className = '',
}: UploadQualityFeedbackProps) {
  const isApproved = result.status === 'approved' || result.status === 'skipped';
  const isReview = result.status === 'review';
  const isRejected = result.status === 'rejected';

  const trackTitle = title || result.trackId;

  return (
    <div
      role="region"
      aria-label={`Quality analysis feedback for ${trackTitle}`}
      className={cn(
        'rounded-2xl border bg-card/80 p-6 backdrop-blur shadow-xl transition-all space-y-6',
        isApproved
          ? 'border-emerald-500/30 dark:border-emerald-500/20'
          : isReview
            ? 'border-amber-500/30 dark:border-amber-500/20'
            : 'border-rose-500/30 dark:border-rose-500/20',
        className
      )}
    >
      {/* Header & Status Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-4">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl',
              isApproved
                ? 'bg-emerald-500/15 text-emerald-400'
                : isReview
                  ? 'bg-amber-500/15 text-amber-400'
                  : 'bg-rose-500/15 text-rose-400'
            )}
          >
            {isApproved ? (
              <CheckCircle2 size={24} />
            ) : isReview ? (
              <AlertTriangle size={24} />
            ) : (
              <XCircle size={24} />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-foreground">{trackTitle}</h3>
              {result.genre && (
                <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {result.genre}
                </span>
              )}
            </div>
            {artist && <p className="text-xs text-muted-foreground">{artist}</p>}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <QualityBadge score={result.score} />
          <span
            className={cn(
              'rounded-full px-3 py-1 text-xs font-semibold capitalize',
              isApproved
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                : isReview
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                  : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
            )}
          >
            {result.status}
          </span>
        </div>
      </div>

      {/* Grid: Quality Score + Genre Threshold + Plagiarism */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Score Card */}
        <div className="rounded-xl border border-border/50 bg-background/50 p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Overall Score</span>
            <Sparkles size={14} className="text-primary" />
          </div>
          <p className="text-2xl font-black text-foreground">
            {Math.round(result.score)}
            <span className="text-sm font-normal text-muted-foreground">/100</span>
          </p>
          <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500',
                isApproved ? 'bg-emerald-500' : isReview ? 'bg-amber-500' : 'bg-rose-500'
              )}
              style={{ width: `${Math.min(100, Math.max(0, result.score))}%` }}
            />
          </div>
        </div>

        {/* Genre Threshold Card */}
        <div className="rounded-xl border border-border/50 bg-background/50 p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Genre Threshold</span>
            <Music2 size={14} className="text-primary" />
          </div>
          <p className="text-2xl font-black text-foreground">
            {Math.round(result.genreThreshold * 100)}
            <span className="text-sm font-normal text-muted-foreground">% required</span>
          </p>
          <p
            className={cn(
              'text-xs font-medium',
              result.passedGenreThreshold ? 'text-emerald-400' : 'text-amber-400'
            )}
          >
            {result.passedGenreThreshold ? '✓ Meets genre standard' : '⚠ Below genre standard'}
          </p>
        </div>

        {/* Plagiarism Check Card */}
        <div className="rounded-xl border border-border/50 bg-background/50 p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Plagiarism Check</span>
            {result.plagiarismCheck?.verdict === 'duplicate' ? (
              <ShieldAlert size={14} className="text-rose-400" />
            ) : result.plagiarismCheck?.verdict === 'suspicious' ? (
              <AlertTriangle size={14} className="text-amber-400" />
            ) : (
              <ShieldCheck size={14} className="text-emerald-400" />
            )}
          </div>
          <p className="text-sm font-bold capitalize text-foreground">
            {result.plagiarismCheck?.verdict || 'Clean'}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {result.plagiarismCheck?.isDuplicate
              ? `Duplicate of ${result.plagiarismCheck.matchedTrackTitle || 'existing track'}`
              : result.plagiarismCheck?.verdict === 'suspicious'
                ? 'Sample review advised'
                : '100% Original acoustic audio'}
          </p>
        </div>
      </div>

      {/* AI Reasons & Feedback Breakdown */}
      {result.reasons && result.reasons.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Info size={14} /> Analysis Feedback & Reasons
          </h4>
          <ul className="space-y-1.5">
            {result.reasons.map((reason, index) => (
              <li
                key={index}
                className="flex items-start gap-2 text-xs text-foreground/80 bg-muted/40 rounded-lg p-2.5 border border-border/30"
              >
                <span className="text-primary font-bold">•</span>
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Multi-track Stem Breakdown if available */}
      {result.stemAnalysis && (
        <div className="space-y-2 border-t border-border/40 pt-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Stem Quality Breakdown ({result.stemAnalysis.stems.length} Stems)
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {result.stemAnalysis.stems.map((stemItem) => (
              <div
                key={stemItem.stem.id}
                className="rounded-lg border border-border/40 p-2 text-xs bg-muted/20"
              >
                <p className="font-semibold truncate">{stemItem.stem.name}</p>
                <p className="text-muted-foreground capitalize">{stemItem.stem.role}</p>
                <p className="text-primary font-bold mt-1">
                  {stemItem.assessment ? `${stemItem.assessment.score}/100` : 'Error'}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-end gap-3 pt-2 border-t border-border/60">
        {isRejected && onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Re-upload / Adjust Track
          </button>
        )}

        {isReview && onRequestManualReview && (
          <button
            type="button"
            onClick={onRequestManualReview}
            className="rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-700 transition-colors"
          >
            Submit for Manual A&R Review
          </button>
        )}

        {isApproved && onPublish && (
          <button
            type="button"
            onClick={onPublish}
            className="rounded-lg bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20"
          >
            Publish to AudioBlocks Catalog
          </button>
        )}
      </div>
    </div>
  );
}

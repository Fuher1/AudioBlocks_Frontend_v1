import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import UploadQualityFeedback from '@/components/ai/UploadQualityFeedback';
import type { UploadQualityPipelineResult } from '@/lib/uploadQualityPipeline';

describe('UploadQualityFeedback component', () => {
  const mockApprovedResult: UploadQualityPipelineResult = {
    trackId: 'track_1',
    status: 'approved',
    score: 95,
    genre: 'Electronic',
    genreThreshold: 0.75,
    passedGenreThreshold: true,
    exempt: false,
    plagiarismCheck: {
      isDuplicate: false,
      similarityScore: 0.05,
      verdict: 'clean',
      matchType: 'none',
      confidence: 0.95,
      reasons: ['No duplicate or plagiarized acoustic matches found in platform registry.'],
    },
    reasons: ['Crisp transient response', 'Well-balanced dynamic range'],
    processedAt: Date.now(),
  };

  it('renders approved track feedback with title, score, and publish button', () => {
    const onPublish = vi.fn();
    render(
      <UploadQualityFeedback
        artist="SynthArtist"
        result={mockApprovedResult}
        title="Midnight Neon"
        onPublish={onPublish}
      />
    );

    expect(screen.getByText('Midnight Neon')).toBeInTheDocument();
    expect(screen.getByText('SynthArtist')).toBeInTheDocument();
    expect(screen.getByText('Electronic')).toBeInTheDocument();
    expect(screen.getByText('95')).toBeInTheDocument();
    expect(screen.getByText(/Meets genre standard/i)).toBeInTheDocument();
    expect(screen.getByText('Crisp transient response')).toBeInTheDocument();

    const publishBtn = screen.getByRole('button', { name: /Publish to AudioBlocks Catalog/i });
    expect(publishBtn).toBeInTheDocument();
    fireEvent.click(publishBtn);
    expect(onPublish).toHaveBeenCalledTimes(1);
  });

  it('renders duplicate rejection feedback with retry button', () => {
    const onRetry = vi.fn();
    const duplicateResult: UploadQualityPipelineResult = {
      trackId: 'track_2',
      status: 'rejected',
      score: 0,
      genre: 'Rock',
      genreThreshold: 0.7,
      passedGenreThreshold: false,
      exempt: false,
      plagiarismCheck: {
        isDuplicate: true,
        similarityScore: 1.0,
        verdict: 'duplicate',
        matchType: 'exact_audio',
        matchedTrackTitle: 'Original Rock Anthem',
        confidence: 1.0,
        reasons: ['Identical audio file checksum matched.'],
      },
      reasons: ['Rejected by plagiarism detector: Identical audio file checksum matched.'],
      processedAt: Date.now(),
    };

    render(
      <UploadQualityFeedback result={duplicateResult} title="Pirated Anthem" onRetry={onRetry} />
    );

    expect(screen.getByText('Pirated Anthem')).toBeInTheDocument();
    expect(screen.getAllByText(/rejected/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('duplicate')).toBeInTheDocument();

    const retryBtn = screen.getByRole('button', { name: /Re-upload \/ Adjust Track/i });
    expect(retryBtn).toBeInTheDocument();
    fireEvent.click(retryBtn);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('renders borderline review feedback with manual review request button', () => {
    const onRequestReview = vi.fn();
    const reviewResult: UploadQualityPipelineResult = {
      trackId: 'track_3',
      status: 'review',
      score: 72,
      genre: 'Classical',
      genreThreshold: 0.85,
      passedGenreThreshold: false,
      exempt: false,
      reasons: ['Quality score (72/100) is borderline for Classical threshold (85/100).'],
      processedAt: Date.now(),
    };

    render(
      <UploadQualityFeedback
        result={reviewResult}
        title="Symphony in C"
        onRequestManualReview={onRequestReview}
      />
    );

    expect(screen.getByText('Symphony in C')).toBeInTheDocument();
    expect(screen.getByText(/Below genre standard/i)).toBeInTheDocument();

    const reviewBtn = screen.getByRole('button', { name: /Submit for Manual A&R Review/i });
    expect(reviewBtn).toBeInTheDocument();
    fireEvent.click(reviewBtn);
    expect(onRequestReview).toHaveBeenCalledTimes(1);
  });
});

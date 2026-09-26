import { beforeEach, describe, it, expect } from 'vitest';
import {
  generateAudioFingerprint,
  registerTrackFingerprint,
  registerTrackFingerprints,
  getRegisteredFingerprints,
  resetPlagiarismRegistry,
  calculateFingerprintSimilarity,
  checkPlagiarism,
  DEFAULT_DUPLICATE_THRESHOLD,
  DEFAULT_SUSPICIOUS_THRESHOLD,
  type AudioFingerprint,
} from '@/lib/plagiarismDetection';

describe('plagiarismDetection (#433)', () => {
  beforeEach(() => {
    resetPlagiarismRegistry();
  });

  const sampleTrackA: AudioFingerprint = {
    trackId: 'track_original_1',
    title: 'Neon Odyssey',
    artist: 'CyberBand',
    genre: 'Synthwave',
    durationSeconds: 210,
    audioHash: 'a1b2c3d4e5f6',
    fingerprintHash: 'fp_neon_odyssey_1',
    spectralFeatures: [0.85, 0.42, 0.91, 0.15, 0.63, 0.77],
  };

  const sampleTrackB: AudioFingerprint = {
    trackId: 'track_original_2',
    title: 'Acoustic Sunrise',
    artist: 'FolkSinger',
    genre: 'Acoustic',
    durationSeconds: 180,
    audioHash: '998877665544',
    fingerprintHash: 'fp_acoustic_sunrise_2',
    spectralFeatures: [0.12, 0.88, 0.25, 0.95, 0.31, 0.22],
  };

  it('generates consistent audio fingerprints from track input', () => {
    const fp = generateAudioFingerprint({
      trackId: 'track_gen_1',
      title: 'Digital Sunset',
      artist: 'SynthArtist',
      durationSeconds: 200,
      audioBuffer: 'simulated_pcm_audio_content',
    });

    expect(fp.trackId).toBe('track_gen_1');
    expect(fp.title).toBe('Digital Sunset');
    expect(fp.audioHash).toBeDefined();
    expect(fp.fingerprintHash).toBeDefined();
  });

  it('registers and retrieves fingerprints in the registry', () => {
    expect(getRegisteredFingerprints()).toHaveLength(0);

    registerTrackFingerprint(sampleTrackA);
    registerTrackFingerprint(sampleTrackB);

    expect(getRegisteredFingerprints()).toHaveLength(2);
    expect(getRegisteredFingerprints()[0].trackId).toBe('track_original_1');

    // Updating existing trackId replaces rather than duplicates
    registerTrackFingerprint({ ...sampleTrackA, title: 'Neon Odyssey (Remastered)' });
    expect(getRegisteredFingerprints()).toHaveLength(2);
    expect(getRegisteredFingerprints()[0].title).toBe('Neon Odyssey (Remastered)');
  });

  it('detects exact audio file duplicates via audio checksum match', () => {
    registerTrackFingerprint(sampleTrackA);

    const duplicateCandidate = {
      trackId: 'track_new_upload',
      title: 'Stolen Track',
      artist: 'Plagiarist',
      audioHash: 'a1b2c3d4e5f6', // identical audioHash to sampleTrackA
    };

    const result = checkPlagiarism(duplicateCandidate);

    expect(result.isDuplicate).toBe(true);
    expect(result.verdict).toBe('duplicate');
    expect(result.matchType).toBe('exact_audio');
    expect(result.similarityScore).toBe(1.0);
    expect(result.matchedTrackId).toBe('track_original_1');
    expect(result.matchedTrackTitle).toBe('Neon Odyssey');
    expect(result.reasons[0]).toMatch(/identical audio file checksum matched/i);
  });

  it('detects acoustic waveform fingerprint matches when audio is near-identical', () => {
    registerTrackFingerprint(sampleTrackA);

    const nearDuplicate = {
      trackId: 'track_near_rip',
      title: 'Neon Odyssey (Re-pitch)',
      artist: 'RipArtist',
      fingerprintHash: 'fp_neon_odyssey_1', // exact acoustic fingerprint match
    };

    const result = checkPlagiarism(nearDuplicate);

    expect(result.isDuplicate).toBe(true);
    expect(result.verdict).toBe('duplicate');
    expect(result.matchType).toBe('acoustic_fingerprint');
    expect(result.similarityScore).toBeGreaterThanOrEqual(DEFAULT_DUPLICATE_THRESHOLD);
    expect(result.matchedTrackId).toBe('track_original_1');
  });

  it('detects spectral feature vector similarity for high-similarity covers/rips', () => {
    registerTrackFingerprint(sampleTrackA);

    // Highly correlated spectral features (cosine similarity > 0.95)
    const similarCandidate = {
      trackId: 'track_similar_rip',
      title: 'Neon Journey',
      artist: 'CoverBand',
      spectralFeatures: [0.84, 0.41, 0.9, 0.16, 0.62, 0.76],
    };

    const result = checkPlagiarism(similarCandidate);

    expect(result.isDuplicate).toBe(true);
    expect(result.verdict).toBe('duplicate');
    expect(result.similarityScore).toBeGreaterThanOrEqual(0.85);
  });

  it('flags moderate similarities as suspicious for manual sample/derivative review', () => {
    registerTrackFingerprint(sampleTrackA);

    // Moderately similar feature vector (cosine similarity ~ 0.75)
    const sampleUsageCandidate = {
      trackId: 'track_sampled_remix',
      title: 'Night Remix',
      artist: 'RemixArtist',
      spectralFeatures: [0.85, 0.42, 0.5, 0.5, 0.3, 0.4],
    };

    const result = checkPlagiarism(sampleUsageCandidate, {
      duplicateThreshold: 0.85,
      suspiciousThreshold: 0.65,
    });

    if (result.similarityScore >= 0.65 && result.similarityScore < 0.85) {
      expect(result.isDuplicate).toBe(false);
      expect(result.verdict).toBe('suspicious');
      expect(result.reasons[0]).toMatch(/flagged for sample\/derivative review/i);
    }
  });

  it('passes completely unique and original tracks as clean', () => {
    registerTrackFingerprints([sampleTrackA, sampleTrackB]);

    const uniqueTrack = {
      trackId: 'track_original_3',
      title: 'Deep Space Meditation',
      artist: 'AmbientGuru',
      durationSeconds: 400,
      audioHash: 'unique_hash_112233',
      fingerprintHash: 'fp_deep_space_unique',
      spectralFeatures: [0.0, 0.0, 0.0, 0.0, 0.0, 0.99],
    };

    const result = checkPlagiarism(uniqueTrack);

    expect(result.isDuplicate).toBe(false);
    expect(result.verdict).toBe('clean');
    expect(result.matchType).toBe('none');
    expect(result.reasons[0]).toMatch(/no duplicate or plagiarized acoustic matches found/i);
  });

  it('supports custom reference libraries and thresholds in checkPlagiarism options', () => {
    const customLibrary = [sampleTrackB];

    const candidate = {
      trackId: 'cand_1',
      title: 'Acoustic Sunrise',
      artist: 'FolkSinger',
      durationSeconds: 180,
    };

    const result = checkPlagiarism(candidate, {
      referenceLibrary: customLibrary,
      duplicateThreshold: 0.9,
    });

    expect(result.matchedTrackId).toBe('track_original_2');
  });
});

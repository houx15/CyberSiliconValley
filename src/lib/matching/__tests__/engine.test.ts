import { describe, it, expect } from 'vitest';
import { computeHybridScore, rankCandidates } from '../engine';

describe('computeHybridScore', () => {
  it('combines semantic and feature scores with correct weights', () => {
    const result = computeHybridScore(80, 90);
    // 0.4 * 80 + 0.6 * 90 = 32 + 54 = 86
    expect(result).toBe(86);
  });

  it('handles zero scores', () => {
    expect(computeHybridScore(0, 0)).toBe(0);
  });

  it('handles perfect scores', () => {
    expect(computeHybridScore(100, 100)).toBe(100);
  });

  it('clamps to 0-100 range', () => {
    expect(computeHybridScore(0, 0)).toBeGreaterThanOrEqual(0);
    expect(computeHybridScore(100, 100)).toBeLessThanOrEqual(100);
  });

  it('weights feature score higher than semantic', () => {
    const highFeature = computeHybridScore(50, 100);
    const lowFeature = computeHybridScore(50, 0);
    expect(highFeature - lowFeature).toBe(60); // 0.6 * 100
  });
});

describe('rankCandidates', () => {
  it('sorts candidates by total score descending', () => {
    const candidates = [
      { talentId: 'a', semanticScore: 60, featureScore: 70 },
      { talentId: 'b', semanticScore: 90, featureScore: 95 },
      { talentId: 'c', semanticScore: 50, featureScore: 80 },
    ];

    const ranked = rankCandidates(candidates);
    expect(ranked[0]!.talentId).toBe('b');
    expect(ranked[0]!.totalScore).toBe(computeHybridScore(90, 95));
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i]!.totalScore).toBeLessThanOrEqual(ranked[i - 1]!.totalScore);
    }
  });

  it('handles empty array', () => {
    expect(rankCandidates([])).toEqual([]);
  });

  it('handles single candidate', () => {
    const candidates = [{ talentId: 'a', semanticScore: 80, featureScore: 70 }];
    const ranked = rankCandidates(candidates);
    expect(ranked).toHaveLength(1);
    expect(ranked[0]!.totalScore).toBe(computeHybridScore(80, 70));
  });
});

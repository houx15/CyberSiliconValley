import { describe, expect, it } from 'vitest';
import { deriveActivityDataFromJobs } from '../activity-status';

describe('activity status', () => {
  it('derives polling stats from the jobs response', () => {
    expect(
      deriveActivityDataFromJobs([
        { matchCount: 3, shortlistedCount: 1 },
        { matchCount: 5, shortlistedCount: 2 },
      ])
    ).toEqual({
      profilesScanned: 40,
      matchesFound: 8,
      preChatActive: 3,
    });
  });
});

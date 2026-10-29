import type { ReadNight } from './types.js';

/**
 * Stub reader for integration. Real implementation will be provided by issue #1.
 * For now, returns empty counts so the status board can compile and test.
 */
export const readNight: ReadNight = (runsDir, night) => {
  return {
    kind: 'missing',
    night,
  };
};

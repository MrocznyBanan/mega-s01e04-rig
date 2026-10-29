import type { ReadNight } from './types.js';

/**
 * Stub pending implementation by issue 1.
 * This module will be replaced by the real reader.
 */
export const readNight: ReadNight = (runsDir, night) => {
  return { kind: 'missing', night };
};

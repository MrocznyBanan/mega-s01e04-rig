import { readdirSync } from 'node:fs';
import type { RigConfig } from './config.js';
import { lastBeat, type Beat } from './heartbeat.js';
import type { DigestCounts } from './digest/types.js';
import type { ReadNight } from './digest/types.js';

export type Night = {
  date: string;
  counts: DigestCounts | null;
};

export type Status = {
  adapter: string;
  installed: string;
  lastBeat: Beat | null;
  nights: Night[];
};

// Nights on disk = runs/<YYYY-MM-DD>.jsonl, newest first.
export function nightsOnDisk(runsDir: string): string[] {
  try {
    return readdirSync(runsDir)
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
      .map((f) => f.slice(0, 10))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

export function readStatus(config: RigConfig): Status {
  let readNight: ReadNight | null = null;
  try {
    // Dynamically import reader if available (provided by issue #1)
    const module = require('./digest/reader.js') as { readNight?: ReadNight };
    readNight = module.readNight ?? null;
  } catch {
    // Reader not available yet
  }

  const nights = nightsOnDisk(config.runsDir).map((date) => {
    let counts: DigestCounts | null = null;
    if (readNight) {
      const result = readNight(config.runsDir, date);
      if (result.kind === 'found') {
        counts = result.counts;
      }
    }
    return { date, counts };
  });

  return {
    adapter: config.adapter,
    installed: config.installed,
    lastBeat: lastBeat(),
    nights,
  };
}

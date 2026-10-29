import { readdirSync } from 'node:fs';
import type { RigConfig } from './config.js';
import { lastBeat, type Beat } from './heartbeat.js';
import { readNight } from './digest/reader.js';
import type { DigestCounts } from './digest/types.js';

export type Night = {
  date: string;
  counts: DigestCounts;
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
  const nights = nightsOnDisk(config.runsDir).map((date) => {
    const result = readNight(config.runsDir, date);
    const counts: DigestCounts =
      result.kind === 'found'
        ? result.counts
        : { ok: 0, retry: 0, fail: 0 };
    return { date, counts };
  });

  return {
    adapter: config.adapter,
    installed: config.installed,
    lastBeat: lastBeat(),
    nights,
  };
}

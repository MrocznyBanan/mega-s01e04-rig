import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, DigestStatus, NightDigest, ReadNight } from './types.js';

type LogEntry = {
  at: string;
  job: string;
  status: DigestStatus;
  owner: string | null;
  error?: string;
};

type JobState = {
  row: DigestRow;
  firstTime: number;
  lastTime: number;
  errorTime: number;
};

function parseEntry(line: string): LogEntry | null {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return null;
  }

  if (
    typeof value !== 'object' || value === null || Array.isArray(value) ||
    !('at' in value) || typeof value.at !== 'string' || !Number.isFinite(Date.parse(value.at)) ||
    !('job' in value) || typeof value.job !== 'string' || value.job.length === 0 ||
    !('status' in value) || (value.status !== 'ok' && value.status !== 'retry' && value.status !== 'fail') ||
    !('owner' in value) || (value.owner !== null && typeof value.owner !== 'string') ||
    ('error' in value && typeof value.error !== 'string')
  ) {
    return null;
  }

  return {
    at: value.at,
    job: value.job,
    status: value.status,
    owner: value.owner,
    error: 'error' in value && typeof value.error === 'string' ? value.error : undefined,
  };
}

export const readNight: ReadNight = (runsDir, night) => {
  if (night.length !== 10 || !/^\d{4}-\d{2}-\d{2}$/.test(night)) {
    return { kind: 'missing', night };
  }

  let contents: string;
  try {
    contents = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return { kind: 'missing', night };
    }
    throw error;
  }

  const digest: NightDigest = {
    kind: 'found',
    night,
    rows: [],
    badLines: 0,
    counts: { ok: 0, retry: 0, fail: 0 },
  };
  const jobs = new Map<string, JobState>();

  for (const line of contents.split(/\r\n|\n|\r/)) {
    if (line.trim() === '') continue;
    const entry = parseEntry(line);
    if (!entry) {
      digest.badLines += 1;
      continue;
    }

    digest.counts[entry.status] += 1;
    const time = Date.parse(entry.at);
    const state = jobs.get(entry.job) ?? {
      firstTime: time,
      lastTime: time,
      errorTime: -Infinity,
      row: {
        job: entry.job,
        owner: entry.owner,
        runs: 0,
        retries: 0,
        failures: 0,
        lastStatus: entry.status,
        lastError: null,
        firstAt: entry.at,
        lastAt: entry.at,
      },
    };
    const { row } = state;
    row.runs += 1;
    row.retries += entry.status === 'retry' ? 1 : 0;
    row.failures += entry.status === 'fail' ? 1 : 0;
    if (time < state.firstTime) {
      state.firstTime = time;
      row.firstAt = entry.at;
    }
    if (time >= state.lastTime) {
      state.lastTime = time;
      row.owner = entry.owner;
      row.lastStatus = entry.status;
      row.lastAt = entry.at;
    }
    if (entry.error !== undefined && time >= state.errorTime) {
      state.errorTime = time;
      row.lastError = entry.error;
    }
    jobs.set(entry.job, state);
  }

  digest.rows = [...jobs.values()]
    .map(({ row }) => row)
    .sort((a, b) => a.job < b.job ? -1 : a.job > b.job ? 1 : 0);
  return digest;
};

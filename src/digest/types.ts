export type DigestStatus = 'ok' | 'retry' | 'fail';

/** Counts of valid log entries, not jobs or final job statuses. */
export type DigestCounts = {
  ok: number;
  retry: number;
  fail: number;
};

/**
 * One job's valid entries, ordered by timestamp instant, then source line.
 * Timestamp strings retain their original spelling and offset.
 */
export type DigestRow = {
  job: string;
  /** Owner on the latest entry, including null; never drops the job. */
  owner: string | null;
  /** All valid entries for this job, including retries and failures. */
  runs: number;
  retries: number;
  /** All fail entries, so a recovered failure can still be marked. */
  failures: number;
  lastStatus: DigestStatus;
  /** Latest supplied error, retained after success; null if none was supplied. */
  lastError: string | null;
  firstAt: string;
  lastAt: string;
};

export type NightDigest = {
  kind: 'found';
  night: string;
  /** Ascending, case-sensitive job order using string comparison, not locale. */
  rows: DigestRow[];
  /** Nonblank lines with invalid JSON or an invalid record shape. */
  badLines: number;
  /** Totals across valid entries; sum equals the sum of rows' runs. */
  counts: DigestCounts;
};

/**
 * Existing empty or entirely malformed files are found, with no rows.
 * Missing files have no digest fields: callers must narrow on kind.
 */
export type ReadNightResult = NightDigest | {
  kind: 'missing';
  night: string;
};

/**
 * Contract for the future named readNight export from ./reader.js.
 * Synchronously reads runsDir/<night>.jsonl without changing the file.
 *
 * Missing files/directories and names outside YYYY-MM-DD return kind: 'missing'.
 * Other filesystem errors propagate. Blank lines are ignored; malformed lines
 * increment badLines without preventing valid entries from being aggregated.
 */
export type ReadNight = (runsDir: string, night: string) => ReadNightResult;

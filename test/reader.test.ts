import { randomUUID } from 'node:crypto';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/reader.js';

const generatedDirs: string[] = [];

afterEach(() => {
  for (const dir of generatedDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function nightFile(contents: string): string {
  const dir = join('var', `reader-test-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  generatedDirs.push(dir);
  writeFileSync(join(dir, '2026-10-28.jsonl'), contents);
  return dir;
}

describe('night reader input boundaries', () => {
  it.each(['', ' \n\t \r\n'])('returns an existing empty night for %j', (contents) => {
    expect(readNight(nightFile(contents), '2026-10-28')).toEqual({
      kind: 'found',
      night: '2026-10-28',
      rows: [],
      badLines: 0,
      counts: { ok: 0, retry: 0, fail: 0 },
    });
  });

  it('distinguishes missing files and directories from existing empty nights', () => {
    const dir = nightFile('');
    expect(readNight(dir, '2026-10-29')).toEqual({ kind: 'missing', night: '2026-10-29' });
    expect(readNight(join(dir, 'missing'), '2026-10-28')).toEqual({ kind: 'missing', night: '2026-10-28' });
  });

  it('rejects traversal and non-YYYY-MM-DD names without treating them as nights', () => {
    const dir = nightFile('');
    const nested = join(dir, 'nested');
    mkdirSync(nested);
    writeFileSync(join(dir, '2026-1-28.jsonl'), '');
    writeFileSync(join(dir, '2026-10-28\n.jsonl'), '');

    expect(readNight(nested, '../2026-10-28')).toEqual({ kind: 'missing', night: '../2026-10-28' });
    expect(readNight(dir, '2026-1-28')).toEqual({ kind: 'missing', night: '2026-1-28' });
    expect(readNight(dir, '2026-10-28\n')).toEqual({ kind: 'missing', night: '2026-10-28\n' });
  });

  it('validates filename shape, not calendar dates', () => {
    const dir = nightFile('');
    writeFileSync(join(dir, '2026-99-99.jsonl'), '');
    expect(readNight(dir, '2026-99-99')).toEqual({
      kind: 'found',
      night: '2026-99-99',
      rows: [],
      badLines: 0,
      counts: { ok: 0, retry: 0, fail: 0 },
    });
  });

  it('propagates filesystem errors other than ENOENT', () => {
    const dir = nightFile('');
    const file = join(dir, '2026-10-28.jsonl');
    expect(() => readNight(file, '2026-10-28')).toThrow(expect.objectContaining({ code: 'ENOTDIR' }));
    rmSync(file);
    mkdirSync(file);
    expect(() => readNight(dir, '2026-10-28')).toThrow(expect.objectContaining({ code: 'EISDIR' }));
  });

  it('counts each malformed nonblank line without losing valid neighbors', () => {
    const entry = { at: '2026-10-28T01:00:00+01:00', job: 'kept', status: 'ok', owner: null };
    const invalidRecords = [
      null, [], 42, true, 'not a record', {},
      { ...entry, at: 42 },
      { ...entry, at: 'not a timestamp' },
      { ...entry, job: '' },
      { ...entry, job: 42 },
      { ...entry, status: 'running' },
      { ...entry, status: null },
      { at: entry.at, job: entry.job, status: entry.status },
      { ...entry, owner: 42 },
      { ...entry, error: null },
      { ...entry, error: 42 },
      { job: entry.job, status: entry.status, owner: null },
      { at: entry.at, status: entry.status, owner: null },
      { at: entry.at, job: entry.job, owner: null },
    ];
    const dir = nightFile([
      JSON.stringify(entry),
      ...invalidRecords.map((record) => JSON.stringify(record)),
      '{broken',
      ' \t ',
      JSON.stringify({ ...entry, error: '', ignored: { extra: true } }),
      '',
    ].join('\r\n'));

    expect(readNight(dir, '2026-10-28')).toEqual({
      kind: 'found',
      night: '2026-10-28',
      badLines: 20,
      counts: { ok: 2, retry: 0, fail: 0 },
      rows: [{
        job: 'kept',
        owner: null,
        runs: 2,
        retries: 0,
        failures: 0,
        lastStatus: 'ok',
        lastError: '',
        firstAt: '2026-10-28T01:00:00+01:00',
        lastAt: '2026-10-28T01:00:00+01:00',
      }],
    });
  });

  it('keeps an entirely malformed file distinct from a missing night', () => {
    expect(readNight(nightFile('{\nnull\n[]\n \n'), '2026-10-28')).toEqual({
      kind: 'found',
      night: '2026-10-28',
      rows: [],
      badLines: 3,
      counts: { ok: 0, retry: 0, fail: 0 },
    });
  });

  it('sorts exact job strings case-sensitively without special object-key behavior', () => {
    const dir = nightFile(['a', 'Z', '__proto__', ' z ', 'A', 'constructor'].map((job) => JSON.stringify({
      at: '2026-10-28T01:00:00+01:00',
      job,
      status: 'ok',
      owner: '',
    })).join('\n'));
    const result = readNight(dir, '2026-10-28');
    expect(result.kind).toBe('found');
    if (result.kind !== 'found') throw new Error('Expected an existing night');
    expect(result.rows.map(({ job, owner }) => ({ job, owner }))).toEqual([
      { job: ' z ', owner: '' },
      { job: 'A', owner: '' },
      { job: 'Z', owner: '' },
      { job: '__proto__', owner: '' },
      { job: 'a', owner: '' },
      { job: 'constructor', owner: '' },
    ]);
  });
});

describe('night reader', () => {
  it('aggregates the real night without dropping null owners or malformed lines', () => {
    expect(readNight('runs', '2026-10-28')).toEqual({
      kind: 'found',
      night: '2026-10-28',
      badLines: 1,
      counts: { ok: 10, retry: 4, fail: 1 },
      rows: [
        {
          job: 'digest/render',
          owner: null,
          runs: 1,
          retries: 0,
          failures: 0,
          lastStatus: 'ok',
          lastError: null,
          firstAt: '2026-10-29T05:41:09+01:00',
          lastAt: '2026-10-29T05:41:09+01:00',
        },
        {
          job: 'fixtures/refresh',
          owner: 'rook',
          runs: 4,
          retries: 3,
          failures: 0,
          lastStatus: 'ok',
          lastError: 'upstream 503',
          firstAt: '2026-10-29T01:30:00+01:00',
          lastAt: '2026-10-29T01:37:00+01:00',
        },
        {
          job: 'lane/sync',
          owner: 'rook',
          runs: 8,
          retries: 1,
          failures: 0,
          lastStatus: 'ok',
          lastError: 'lock held',
          firstAt: '2026-10-28T23:00:06+01:00',
          lastAt: '2026-10-29T05:00:04+01:00',
        },
        {
          job: 'notes/backup',
          owner: 'lane-07',
          runs: 1,
          retries: 0,
          failures: 1,
          lastStatus: 'fail',
          lastError: 'quota exceeded',
          firstAt: '2026-10-29T04:00:01+01:00',
          lastAt: '2026-10-29T04:00:01+01:00',
        },
        {
          job: 'rig/rotate-logs',
          owner: 'lane-07',
          runs: 1,
          retries: 0,
          failures: 0,
          lastStatus: 'ok',
          lastError: null,
          firstAt: '2026-10-28T23:00:02+01:00',
          lastAt: '2026-10-28T23:00:02+01:00',
        },
      ],
    });
  });

  it('orders entries by instant while retaining offsets, explicit errors and recovered failures', () => {
    const dir = nightFile([
      { at: '2026-10-28T01:15:00-03:00', job: 'sync', status: 'ok', owner: null },
      { at: '2026-10-28T06:00:00+02:00', job: 'sync', status: 'retry', owner: 'retry-owner', error: 'latest error' },
      { at: '2026-10-28T05:30:00+02:00', job: 'sync', status: 'fail', owner: 'failed-owner', error: 'older error' },
      { at: '2026-10-28T00:00:00-03:00', job: 'sync', status: 'retry', owner: 'first-owner' },
    ].map((entry) => JSON.stringify(entry)).join('\n'));

    expect(readNight(dir, '2026-10-28')).toEqual({
      kind: 'found',
      night: '2026-10-28',
      badLines: 0,
      counts: { ok: 1, retry: 2, fail: 1 },
      rows: [{
        job: 'sync',
        owner: null,
        runs: 4,
        retries: 2,
        failures: 1,
        lastStatus: 'ok',
        lastError: 'latest error',
        firstAt: '2026-10-28T00:00:00-03:00',
        lastAt: '2026-10-28T01:15:00-03:00',
      }],
    });
  });

  it('breaks equal-instant ties by line order, including explicitly empty errors', () => {
    const dir = nightFile([
      { at: '2026-10-28T03:00:00+02:00', job: 'sync', status: 'retry', owner: 'first', error: 'first error' },
      { at: '2026-10-28T04:00:00+02:00', job: 'sync', status: 'fail', owner: 'failed', error: 'failure' },
      { at: '2026-10-28T01:00:00Z', job: 'sync', status: 'ok', owner: 'earlier' },
      { at: '2026-10-28T02:00:00Z', job: 'sync', status: 'retry', owner: 'latest', error: '' },
      { at: '2026-10-28T02:00:00+00:00', job: 'sync', status: 'ok', owner: null },
    ].map((entry) => JSON.stringify(entry)).join('\n'));

    expect(readNight(dir, '2026-10-28')).toEqual({
      kind: 'found',
      night: '2026-10-28',
      badLines: 0,
      counts: { ok: 2, retry: 2, fail: 1 },
      rows: [{
        job: 'sync',
        owner: null,
        runs: 5,
        retries: 2,
        failures: 1,
        lastStatus: 'ok',
        lastError: '',
        firstAt: '2026-10-28T03:00:00+02:00',
        lastAt: '2026-10-28T02:00:00+00:00',
      }],
    });
  });
});

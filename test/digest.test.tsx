import { describe, expect, it } from 'vitest';
import { DigestView } from '../src/views/digest.js';
import type { ReadNightResult } from '../src/digest/types.js';

describe('DigestView component', () => {
  it('renders missing night warning', async () => {
    const result: ReadNightResult = { kind: 'missing', night: '2026-10-29' };
    const html = await DigestView({ result }).toString();
    expect(html).toContain('digest for 2026-10-29');
    expect(html).toContain('night not found');
    expect(html).toContain('warn');
  });

  it('renders digest table with rows sorted by job', async () => {
    const result: ReadNightResult = {
      kind: 'found',
      night: '2026-10-28',
      rows: [
        {
          job: 'build',
          owner: 'alice',
          runs: 5,
          retries: 2,
          failures: 0,
          lastStatus: 'ok',
          lastError: null,
          firstAt: '2026-10-28T10:00:00+01:00',
          lastAt: '2026-10-28T10:15:00+01:00',
        },
        {
          job: 'deploy',
          owner: null,
          runs: 3,
          retries: 4,
          failures: 1,
          lastStatus: 'fail',
          lastError: 'timeout',
          firstAt: '2026-10-28T10:20:00+01:00',
          lastAt: '2026-10-28T10:45:00+01:00',
        },
      ],
      badLines: 2,
      counts: { ok: 6, retry: 4, fail: 1 },
    };
    const html = await DigestView({ result }).toString();
    expect(html).toContain('digest for 2026-10-28');
    expect(html).toContain('build');
    expect(html).toContain('alice');
    expect(html).toContain('deploy');
    expect(html).toContain('2 malformed lines');
    expect(html).toContain('counts: ok 6 · retry 4 · fail 1');
  });

  it('marks retries >= 3 with warn class', async () => {
    const result: ReadNightResult = {
      kind: 'found',
      night: '2026-10-28',
      rows: [
        {
          job: 'deploy',
          owner: null,
          runs: 3,
          retries: 4,
          failures: 0,
          lastStatus: 'ok',
          lastError: null,
          firstAt: '2026-10-28T10:20:00+01:00',
          lastAt: '2026-10-28T10:45:00+01:00',
        },
      ],
      badLines: 0,
      counts: { ok: 3, retry: 0, fail: 0 },
    };
    const html = await DigestView({ result }).toString();
    expect(html).toContain('<td class="warn">4</td>');
  });

  it('marks failures > 0 with warn class even after success', async () => {
    const result: ReadNightResult = {
      kind: 'found',
      night: '2026-10-28',
      rows: [
        {
          job: 'test',
          owner: 'bob',
          runs: 5,
          retries: 1,
          failures: 2,
          lastStatus: 'ok',
          lastError: null,
          firstAt: '2026-10-28T09:00:00+01:00',
          lastAt: '2026-10-28T09:30:00+01:00',
        },
      ],
      badLines: 0,
      counts: { ok: 3, retry: 0, fail: 2 },
    };
    const html = await DigestView({ result }).toString();
    expect(html).toContain('<td class="warn">2</td>');
    expect(html).toContain('ok');
  });

  it('renders null owner as — and null lastError as —', async () => {
    const result: ReadNightResult = {
      kind: 'found',
      night: '2026-10-28',
      rows: [
        {
          job: 'orphan',
          owner: null,
          runs: 1,
          retries: 0,
          failures: 0,
          lastStatus: 'ok',
          lastError: null,
          firstAt: '2026-10-28T11:00:00+01:00',
          lastAt: '2026-10-28T11:00:00+01:00',
        },
      ],
      badLines: 0,
      counts: { ok: 1, retry: 0, fail: 0 },
    };
    const html = await DigestView({ result }).toString();
    expect(html).toContain('<td>—</td>'); // null owner
    expect(html).toContain('<td>—</td>'); // null lastError
  });

  it('preserves original timestamp offsets', async () => {
    const result: ReadNightResult = {
      kind: 'found',
      night: '2026-10-28',
      rows: [
        {
          job: 'tz-check',
          owner: 'carol',
          runs: 1,
          retries: 0,
          failures: 0,
          lastStatus: 'ok',
          lastError: null,
          firstAt: '2026-10-28T08:15:30-04:00',
          lastAt: '2026-10-28T08:20:15-04:00',
        },
      ],
      badLines: 0,
      counts: { ok: 1, retry: 0, fail: 0 },
    };
    const html = await DigestView({ result }).toString();
    expect(html).toContain('2026-10-28T08:15:30-04:00');
    expect(html).toContain('2026-10-28T08:20:15-04:00');
  });

  it('shows malformed-line warning and nothing ran when all entries are malformed', async () => {
    const result: ReadNightResult = {
      kind: 'found',
      night: '2026-10-27',
      rows: [],
      badLines: 5,
      counts: { ok: 0, retry: 0, fail: 0 },
    };
    const html = await DigestView({ result }).toString();
    expect(html).toContain('digest for 2026-10-27');
    expect(html).toContain('5 malformed lines');
    expect(html).toContain('nothing ran');
  });

  it('renders nothing ran for empty night with no malformed lines', async () => {
    const result: ReadNightResult = {
      kind: 'found',
      night: '2026-10-26',
      rows: [],
      badLines: 0,
      counts: { ok: 0, retry: 0, fail: 0 },
    };
    const html = await DigestView({ result }).toString();
    expect(html).toContain('digest for 2026-10-26');
    expect(html).toContain('nothing ran');
    expect(html).not.toContain('malformed lines');
  });
});

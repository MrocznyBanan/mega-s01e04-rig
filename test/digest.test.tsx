import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createApp } from '../src/app.js';

const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: 'runs' };

// Mock readNight to avoid dependency on actual file system
vi.mock('../src/digest/reader.js', async () => {
  const actual = await vi.importActual<typeof import('../src/digest/reader.js')>('../src/digest/reader.js');
  return {
    readNight: vi.fn((runsDir: string, night: string) => {
      if (night === '2026-10-28') {
        return {
          kind: 'found' as const,
          night: '2026-10-28',
          rows: [
            {
              job: 'build',
              owner: 'alice',
              runs: 5,
              retries: 2,
              failures: 0,
              lastStatus: 'ok' as const,
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
              lastStatus: 'fail' as const,
              lastError: 'timeout',
              firstAt: '2026-10-28T10:20:00+01:00',
              lastAt: '2026-10-28T10:45:00+01:00',
            },
          ],
          badLines: 2,
          counts: { ok: 6, retry: 4, fail: 1 },
        };
      }
      return { kind: 'missing' as const, night };
    }),
  };
});

describe('digest route', () => {
  it('shows digest for a valid night', async () => {
    const res = await createApp(config).request('/digest/2026-10-28');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('digest for 2026-10-28');
    expect(html).toContain('build');
    expect(html).toContain('alice');
    expect(html).toContain('deploy');
    expect(html).toContain('—'); // null owner
    expect(html).toContain('2 malformed lines');
    expect(html).toContain('timeout'); // lastError
  });

  it('marks retries >= 3 with warn class', async () => {
    const res = await createApp(config).request('/digest/2026-10-28');
    const html = await res.text();
    expect(html).toContain('<td class="warn">4</td>'); // deploy retries
  });

  it('marks failures > 0 with warn class', async () => {
    const res = await createApp(config).request('/digest/2026-10-28');
    const html = await res.text();
    expect(html).toContain('<td class="warn">1</td>'); // deploy failures
  });

  it('returns 404 for missing night', async () => {
    const res = await createApp(config).request('/digest/2026-10-29');
    expect(res.status).toBe(404);
  });
});


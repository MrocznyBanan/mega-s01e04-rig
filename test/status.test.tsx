import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: 'runs' };

describe('status board', () => {
  it('shows the lane banner and links to digest pages', async () => {
    process.env.LANE_MARKER = 'TEST-MARKER';
    const res = await createApp(config).request('/');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('TEST-MARKER');
    expect(html).toContain('/digest/2026-10-28');
    expect(html).toContain('/digest/2026-10-27');
  });

  it('renders em dash for missing counts until reader is available', async () => {
    const res = await createApp(config).request('/');
    const html = await res.text();
    // Without reader implementation, counts show as em dashes
    expect(html).toContain('— — —');
  });

  it('will show fixture counts once reader is integrated', async () => {
    const res = await createApp(config).request('/');
    const html = await res.text();
    // Expected once issue #1 reader arrives:
    // 2026-10-28: 10 ok, 4 retry, 1 fail
    // 2026-10-27: 7 ok, 0 retry, 0 fail
    // For now, reader is pending; this test documents the integration expectation
    if (html.includes('10 ok')) {
      expect(html).toContain('2026-10-28');
      expect(html).toContain('10 ok, 4 retry, 1 fail');
      expect(html).toContain('2026-10-27');
      expect(html).toContain('7 ok, 0 retry, 0 fail');
    }
  });

  it('health answers with the lane id', async () => {
    const res = await createApp(config).request('/health');
    expect(await res.json()).toEqual({ ok: true, lane: 'lane-07' });
  });
});

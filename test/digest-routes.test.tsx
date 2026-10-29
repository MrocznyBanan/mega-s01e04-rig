import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { createApp } from '../src/app.js';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

describe('digest routes', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(process.cwd(), 'runs-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('returns 404 for missing night', async () => {
    const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: tempDir };
    const res = await createApp(config).request('/digest/2099-01-01');
    expect(res.status).toBe(404);
  });

  it('returns 404 for missing /api/digest/:night', async () => {
    const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: tempDir };
    const res = await createApp(config).request('/api/digest/2099-01-01');
    expect(res.status).toBe(404);
  });

  it('returns 200 with HTML for existing night', async () => {
    writeFileSync(join(tempDir, '2026-10-30.jsonl'), '{"at":"2026-10-30T10:00:00+01:00","job":"test/job","status":"ok","owner":"tester"}\n');
    const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: tempDir };
    const res = await createApp(config).request('/digest/2026-10-30');
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('test/job');
  });

  it('returns 200 with JSON for existing night', async () => {
    writeFileSync(join(tempDir, '2026-10-30.jsonl'), '{"at":"2026-10-30T10:00:00+01:00","job":"test/job","status":"ok","owner":"tester"}\n');
    const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: tempDir };
    const res = await createApp(config).request('/api/digest/2026-10-30');
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.kind).toBe('found');
    expect(json.night).toBe('2026-10-30');
    expect(json.rows).toHaveLength(1);
    expect(json.rows[0].job).toBe('test/job');
  });

  it('returns 200 for empty night file', async () => {
    writeFileSync(join(tempDir, '2026-10-30.jsonl'), '');
    const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: tempDir };
    const res = await createApp(config).request('/api/digest/2026-10-30');
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.kind).toBe('found');
    expect(json.rows).toHaveLength(0);
    expect(json.badLines).toBe(0);
  });

  it('preserves valid records alongside bad lines', async () => {
    const content = [
      '{"at":"2026-10-30T10:00:00+01:00","job":"job-a","status":"ok","owner":"alice"}\n',
      'not valid json\n',
      '{"at":"2026-10-30T10:01:00+01:00","job":"job-b","status":"ok","owner":"bob"}\n',
    ].join('');
    writeFileSync(join(tempDir, '2026-10-30.jsonl'), content);
    const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: tempDir };
    const res = await createApp(config).request('/api/digest/2026-10-30');
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.kind).toBe('found');
    expect(json.badLines).toBe(1);
    expect(json.rows).toHaveLength(2);
  });

  it('orders jobs by case-sensitive string comparison', async () => {
    const content = [
      '{"at":"2026-10-30T10:00:00+01:00","job":"zebra","status":"ok","owner":"z"}\n',
      '{"at":"2026-10-30T10:00:01+01:00","job":"apple","status":"ok","owner":"a"}\n',
      '{"at":"2026-10-30T10:00:02+01:00","job":"Banana","status":"ok","owner":"b"}\n',
    ].join('');
    writeFileSync(join(tempDir, '2026-10-30.jsonl'), content);
    const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: tempDir };
    const htmlRes = await createApp(config).request('/digest/2026-10-30');
    const jsonRes = await createApp(config).request('/api/digest/2026-10-30');
    
    const json = await jsonRes.json();
    const jobs = json.rows.map((r: any) => r.job);
    expect(jobs).toEqual(['Banana', 'apple', 'zebra']);
    
    const html = await htmlRes.text();
    const firstBanana = html.indexOf('Banana');
    const firstApple = html.indexOf('apple');
    const firstZebra = html.indexOf('zebra');
    expect(firstBanana).toBeLessThan(firstApple);
    expect(firstApple).toBeLessThan(firstZebra);
  });

  it('HTML and JSON agree on content and order', async () => {
    const content = [
      '{"at":"2026-10-30T10:00:00+01:00","job":"job-x","status":"ok","owner":"ox"}\n',
      '{"at":"2026-10-30T10:00:01+01:00","job":"job-a","status":"fail","owner":null}\n',
    ].join('');
    writeFileSync(join(tempDir, '2026-10-30.jsonl'), content);
    const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: tempDir };
    
    const jsonRes = await createApp(config).request('/api/digest/2026-10-30');
    const json = await jsonRes.json();
    
    const htmlRes = await createApp(config).request('/digest/2026-10-30');
    const html = await htmlRes.text();
    
    for (const row of json.rows) {
      expect(html).toContain(row.job);
      expect(html).toContain(row.lastStatus);
    }
  });

  it('HTML returns 200 for empty existing night file', async () => {
    writeFileSync(join(tempDir, '2026-10-30.jsonl'), '');
    const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: tempDir };
    const res = await createApp(config).request('/digest/2026-10-30');
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toBeTruthy();
  });

  it('HTML shows valid rows alongside bad line in same file', async () => {
    const content = [
      '{"at":"2026-10-30T10:00:00+01:00","job":"job-valid","status":"ok","owner":"alice"}\n',
      'corrupt junk data here\n',
      '{"at":"2026-10-30T10:00:01+01:00","job":"job-second","status":"fail","owner":"bob"}\n',
    ].join('');
    writeFileSync(join(tempDir, '2026-10-30.jsonl'), content);
    const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: tempDir };
    const res = await createApp(config).request('/digest/2026-10-30');
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('job-valid');
    expect(html).toContain('job-second');
  });

  it('HTML returns 200 for file with only malformed lines', async () => {
    const content = [
      'bad json\n',
      '{incomplete json\n',
      'not even close to valid\n',
    ].join('');
    writeFileSync(join(tempDir, '2026-10-30.jsonl'), content);
    const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: tempDir };
    const res = await createApp(config).request('/digest/2026-10-30');
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toBeTruthy();
  });
});

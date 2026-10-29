import { Hono } from 'hono';
import { loadConfig, type RigConfig } from './config.js';
import { lane } from './lane.js';
import { readStatus } from './status.js';
import { Layout } from './views/layout.js';
import { StatusBoard } from './views/status.js';
import { DigestView } from './views/digest.js';

export function createApp(config: RigConfig = loadConfig()) {
  const app = new Hono();

  app.get('/health', (c) => c.json({ ok: true, lane: lane().id }));

  app.get('/', (c) =>
    c.html(
      <Layout title="status" lane={lane()}>
        <StatusBoard status={readStatus(config)} />
      </Layout>,
    ),
  );

  app.get('/digest/:night', async (c) => {
    const night = c.req.param('night');
    try {
      const { readNight } = await import('./digest/reader.js');
      const result = readNight(config.runsDir, night);
      if (result.kind === 'missing') {
        return c.notFound();
      }
      return c.html(
        <Layout title={`digest · ${night}`} lane={lane()}>
          <DigestView result={result} />
        </Layout>,
      );
    } catch {
      return c.html(
        <Layout title={`digest · ${night}`} lane={lane()}>
          <p class="warn">digest reader not available</p>
        </Layout>,
        500,
      );
    }
  });

  return app;
}

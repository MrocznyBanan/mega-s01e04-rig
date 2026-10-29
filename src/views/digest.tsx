import type { NightDigest, ReadNightResult } from '../digest/types.js';

export function DigestView({ result }: { result: ReadNightResult }) {
  if (result.kind === 'missing') {
    return (
      <>
        <h1>digest for {result.night}</h1>
        <p class="warn">night not found</p>
      </>
    );
  }

  const { night, rows, badLines, counts } = result as NightDigest;

  return (
    <>
      <h1>digest for {night}</h1>
      {rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <>
          {badLines > 0 && <p class="warn">{badLines} malformed line{badLines !== 1 ? 's' : ''}</p>}
          <table>
            <thead>
              <tr>
                <th>job</th>
                <th>owner</th>
                <th>runs</th>
                <th>retries</th>
                <th>failures</th>
                <th>last status</th>
                <th>last error</th>
                <th>first at</th>
                <th>last at</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.job}>
                  <td>{row.job}</td>
                  <td>{row.owner ?? '—'}</td>
                  <td>{row.runs}</td>
                  <td class={row.retries >= 3 ? 'warn' : ''}>{row.retries}</td>
                  <td class={row.failures > 0 ? 'warn' : ''}>{row.failures}</td>
                  <td>{row.lastStatus}</td>
                  <td>{row.lastError ?? '—'}</td>
                  <td>{row.firstAt}</td>
                  <td>{row.lastAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p class="mute">counts: ok {counts.ok} · retry {counts.retry} · fail {counts.fail}</p>
        </>
      )}
    </>
  );
}

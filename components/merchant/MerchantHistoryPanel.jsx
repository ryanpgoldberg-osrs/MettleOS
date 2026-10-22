"use client";
import { useEffect, useState } from 'react';
export default function MarginHistory({ itemId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/prices/history?itemId=${itemId}`, { signal: controller.signal }).then(async res => {
      if (!res.ok) throw new Error('Could not load margin history.');
      const payload = await res.json();
      if (!controller.signal.aborted) setData(payload.summary);
    }).catch(e => { if (!controller.signal.aborted && e.name !== 'AbortError') setError('History unavailable. No historical conclusion is available.'); });
    return () => controller.abort();
  }, [itemId, attempt]);
  const percent = value => value === null ? 'Unavailable' : `${value.toFixed(0)}%`;
  return <section aria-label="Margin history" style={{ gridColumn: '1 / -1', lineHeight: 1.6 }}>
    <strong>Margin persistence · last 24 completed hours</strong>
    {!data && !error ? <p role="status">Loading hourly history…</p> : null}
    {error ? <p role="alert">{error} <button type="button" onClick={() => { setData(null); setError(''); setAttempt(n => n + 1); }}>Retry history</button></p> : null}
    {data ? <>
      <dl style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <div><dt>Positive after-tax margin</dt><dd style={{ margin: 0 }}>{percent(data.profitablePercent)} of observed hours</dd></div>
        <div><dt>Crossed prices</dt><dd style={{ margin: 0 }}>{percent(data.crossedPercent)} of observed hours</dd></div>
        <div><dt>Two-sided coverage</dt><dd style={{ margin: 0 }}>{data.sampleCount} / 24 hours</dd></div>
        <div><dt>Median unit margin</dt><dd style={{ margin: 0 }}>{data.medianMargin === null ? 'Unavailable' : `${data.medianMargin.toLocaleString()} gp`}</dd></div>
      </dl>
      {!data.sufficient || data.stale ? <p style={{ color: '#f0e0ad' }}>{data.stale ? 'History is stale or missing. ' : ''}{!data.sufficient ? 'Sparse history: fewer than 12 two-sided hours. ' : ''}These observations do not establish a persistent margin.</p> : null}
      <p>Hourly averages describe past trades, not simultaneous executable offers or a fill success rate. Missing sides are excluded, not counted as profitable. History does not change the live score.</p>
      {data.samples.length ? <details><summary>Inspect hourly margins</summary><div style={{ overflowX: 'auto' }}><table style={{ width: '100%', textAlign: 'left' }}><thead><tr><th>Hour</th><th>Buy avg</th><th>Sell avg</th><th>Net/unit</th></tr></thead><tbody>
        {data.samples.slice().reverse().map(p => <tr key={p.timestamp}><td>{new Date(p.timestamp * 1000).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit' })}</td><td>{p.buy.toLocaleString()}</td><td>{p.sell.toLocaleString()}</td><td>{p.margin.toLocaleString()}</td></tr>)}
      </tbody></table></div></details> : null}
    </> : null}
  </section>;
}

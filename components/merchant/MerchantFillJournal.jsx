"use client";
import { useEffect, useRef, useState } from 'react';
import { JOURNAL_KEY, startTrade, addFill, closeTrade, compareTrade, parseJournal, serializeJournal, summarizeJournal } from './tradeJournal';

export function useTradeJournal() {
  const savedRaw = useRef(null);
  const [trades, setTrades] = useState([]);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [blocked, setBlocked] = useState(false);
  useEffect(() => {
    try { const raw = localStorage.getItem(JOURNAL_KEY); setTrades(parseJournal(raw)); savedRaw.current = raw; }
    catch { setBlocked(true); setError('The saved fill log could not be read. Existing data is preserved. Export or repair it before recording more trades.'); }
    finally { setLoaded(true); }
  }, []);
  function save(next) {
    // Persist first: a failed write must not look like a successfully recorded fill.
    if (localStorage.getItem(JOURNAL_KEY) !== savedRaw.current) throw new Error('The fill log changed in another tab. Reload the saved log before continuing.');
    const raw = serializeJournal(next);
    localStorage.setItem(JOURNAL_KEY, raw); savedRaw.current = raw;
    setTrades(next); setError('');
  }
  function run(action) {
    try {
      if (!loaded || blocked) throw new Error(error || 'Fill log is still loading.');
      action(); return true;
    } catch (e) { setError(e.message || 'Could not save fill log. Browser storage may be full.'); return false; }
  }
  return { trades, error, loaded,
    start: item => run(() => {
      if (trades.length >= 500) throw new Error('The local journal has reached its 500-trade limit. Export it before starting a new journal.');
      save([startTrade(item, crypto.randomUUID()), ...trades]);
    }),
    fill: (id, fill) => run(() => save(trades.map(t => t.id === id ? addFill(t, fill) : t))),
    close: id => run(() => save(trades.map(t => t.id === id ? closeTrade(t) : t))),
    retry: () => {
      try { const raw = localStorage.getItem(JOURNAL_KEY); setTrades(parseJournal(raw)); savedRaw.current = raw; setError(''); setBlocked(false); }
      catch { setBlocked(true); setError('The saved fill log still cannot be read. It has not been overwritten.'); }
    },
  };
}
const inputStyle = { width: '100%', boxSizing: 'border-box', background: '#101010', color: '#d2d2cf', border: '1px solid #444', padding: '8px', font: 'inherit', marginTop: '4px' };
const buttonStyle = { background: '#1b160b', color: '#f0e0ad', border: '1px solid #8f7530', padding: '8px', cursor: 'pointer', font: 'inherit' };
function localTime() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 19);
}
function FillForm({ trade, onFill }) {
  const [side, setSide] = useState('buy'), [quantity, setQuantity] = useState(''), [price, setPrice] = useState('');
  const [time, setTime] = useState(localTime);
  const [error, setError] = useState('');
  function submit(event) {
    event.preventDefault();
    if (!/^\d+$/.test(quantity) || !/^\d+$/.test(price)) { setError('Enter positive whole numbers for quantity and gp per item.'); return; }
    if (onFill(trade.id, { side, quantity: Number(quantity), price: Number(price), filledAt: new Date(time).getTime() })) {
      setQuantity(''); setPrice(''); setTime(localTime()); setError('');
    }
  }
  return <form onSubmit={submit} aria-label={`Record fill for ${trade.name}`}>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', marginBottom: '12px' }}>
      <label>Side<select style={inputStyle} value={side} onChange={e => setSide(e.target.value)}><option value="buy">Buy fill</option><option value="sell">Sell fill</option></select></label>
      <label>Filled quantity<input style={inputStyle} inputMode="numeric" required value={quantity} onChange={e => setQuantity(e.target.value)} /></label>
      <label>Price per item (gp)<input style={inputStyle} inputMode="numeric" required value={price} onChange={e => setPrice(e.target.value)} /></label>
      <label>Fill time (local)<input style={inputStyle} type="datetime-local" step="1" required value={time} onChange={e => setTime(e.target.value)} /></label>
    </div>
    {error ? <p role="alert">{error}</p> : null}
    <button style={buttonStyle} type="submit">Record actual fill</button>
  </form>;
}
export default function TradeJournal({ journal }) {
  const summary = summarizeJournal(journal.trades);
  const gp = n => `${n.toLocaleString()} gp`;
  const minutes = n => n === null ? '—' : `${n.toFixed(1)}m`;
  function exportLog() {
    const url = URL.createObjectURL(new Blob([localStorage.getItem(JOURNAL_KEY) ?? serializeJournal(journal.trades)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = 'mettle-merchant-fills.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <section aria-label="Actual fill journal" style={{ color: '#d2d2cf', fontSize: '12px', lineHeight: 1.7 }}>
    <h2 style={{ fontSize: '16px', color: '#f0e0ad' }}>Actual fills · local journal</h2>
    <p>Start a flip from an item’s expanded card to freeze its model. Enter actual partial or complete fills below. This log is stored only in this browser, separately from your ascent save.</p>
    <p>{summary.open} open · {summary.completed}/{summary.closed} closed trades fully sold · {summary.unfilled} closed without buys · {gp(summary.realizedProfit)} realized after tax</p>
    {summary.averageDurationRatio !== null ? <p>Completed trades took {summary.averageDurationRatio.toFixed(2)}× their modeled duration on average.</p> : null}
    <p>This self-reported sample includes your manual closing decisions; it does not automatically recalibrate the 5% participation assumption or establish a success rate.</p>
    <button type="button" style={buttonStyle} onClick={exportLog}>Export fill log</button>
    {journal.error ? <p role="alert">{journal.error} <button type="button" style={buttonStyle} onClick={journal.retry}>Reload saved log</button></p> : null}
    {!journal.trades.length ? <p>No fills logged yet. Open More on a candidate and choose Start flip log.</p> : null}
    {journal.trades.map(trade => {
      const actual = compareTrade(trade);
      return <article key={trade.id} style={{ border: '1px solid #444', padding: '14px', marginTop: '16px' }}>
        <h3 style={{ marginTop: 0 }}>{trade.name} · {trade.endedAt === null ? 'Open' : actual.completed ? 'Closed / fully sold' : 'Closed / incomplete'}</h3>
        <p>Started {new Date(trade.startedAt).toLocaleString()} · original signal {trade.model.signal} · {trade.model.participation * 100}% assumed participation{trade.model.volumeEstimated ? ' · estimated flow' : ''}</p>
        <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', textAlign: 'left' }}>
          <thead><tr><th>Measure</th><th>Frozen model</th><th>Actual</th></tr></thead><tbody>
            <tr><td>Quantity</td><td>{trade.model.quantity.toLocaleString()}</td><td>{actual.bought.toLocaleString()} bought / {actual.sold.toLocaleString()} sold</td></tr>
            <tr><td>Batch profit</td><td>{gp(trade.model.profit)}</td><td>{gp(actual.realizedProfit)} realized</td></tr>
            <tr><td>Buy leg</td><td>{minutes(trade.model.buyMinutes)}</td><td>{minutes(actual.buyMinutes)} to last buy</td></tr>
            <tr><td>Sell leg</td><td>{minutes(trade.model.sellMinutes)}</td><td>{minutes(actual.sellMinutes)} after last buy (— if legs overlap)</td></tr>
            <tr><td>Total elapsed</td><td>{minutes(trade.model.durationMinutes)}</td><td>{minutes(actual.elapsedMinutes)}{actual.completed || trade.endedAt === null ? ' to last sale' : ' to close'}</td></tr>
          </tbody>
        </table></div>
        <p>{actual.remaining.toLocaleString()} unsold (unrealized). On the {actual.sold.toLocaleString()} sold units, the model implied {gp(actual.modelForSoldQuantity)}; actual difference {gp(actual.profitDelta)}. Actual tax: {gp(actual.tax)}.</p>
        {trade.endedAt === null ? <>
          <FillForm trade={trade} onFill={journal.fill} />
          <button style={{ ...buttonStyle, marginTop: '12px' }} type="button" onClick={() => journal.close(trade.id)}>Finish / abandon log</button>
          <p>Close unfilled or partial attempts too, so slow and unsuccessful flips remain in the comparison. Unsold inventory is never counted as realized profit.</p>
        </> : null}
        {trade.fills.length ? <details><summary>{trade.fills.length} recorded fills</summary><ul>{trade.fills.map((fill,i) => <li key={i}>{fill.side} {fill.quantity.toLocaleString()} × {gp(fill.price)} · {new Date(fill.filledAt).toLocaleString()}</li>)}</ul></details> : null}
      </article>;
    })}
  </section>;
}

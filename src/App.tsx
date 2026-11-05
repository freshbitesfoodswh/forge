import { useEffect, useRef, useState } from 'react';
import JSZip from 'jszip';
import { applyPrompt, bundle, render, Spec } from './generator';
import { architect, analyst, Bot, loadBots, saveBots, callBot, testBot } from './agents';
import CanvasBoard from './CanvasBoard';

interface Att { name: string; type: string; url: string; size: number }
interface Msg { role: 'user'|'forge'; text: string; atts?: Att[]; from?: string }
interface Project { spec: Spec|null; files: Record<string,string>; messages: Msg[]; checkpoints?: { at: string; spec: Spec|null; files: Record<string,string> }[] }
const STARTERS = [['Landing','Build a landing page for a mindful journaling app'],['Dashboard','Build an analytics dashboard'],['Waitlist','Build a wellness waitlist landing page'],['Blog','Build a blog about gratitude'],['Link-in-bio','Build a link in bio page for a creator']];
const readFile = (f: File) => new Promise<Att>(r => { const fr = new FileReader(); fr.onload = () => r({ name: f.name, type: f.type, size: f.size, url: String(fr.result) }); fr.readAsDataURL(f); });
const md = (t: string) => t.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');

export default function App() {
  const [p, setP] = useState<Project>({ spec: null, files: {}, messages: [{ role: 'forge', text: "Hi! Tell me what to build — or pick a starter. Paste or attach images and I'll use them. Everything runs locally; no keys, no credits." }] });
  const [input, setInput] = useState(''); const [atts, setAtts] = useState<Att[]>([]);
  const [tab, setTab] = useState<'preview'|'code'|'canvas'|'bots'>('preview');
  const [bots, setBots] = useState<Bot[]>(loadBots); const [target, setTarget] = useState<string[]>(['forge']); const [edit, setEdit] = useState<Bot|null>(null); const [tst, setTst] = useState<Record<string,string>>({});
  useEffect(() => saveBots(bots), [bots]); const [file, setFile] = useState('index.html');
  const [mtab, setMtab] = useState<'chat'|'preview'|'code'|'canvas'|'bots'>('chat');
  const [device, setDevice] = useState<'desktop'|'tablet'|'mobile'>('desktop');
  const [publish, setPublish] = useState(false); const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null); const endRef = useRef<HTMLDivElement>(null); const loaded = useRef(false);

  useEffect(() => { const ls = localStorage.getItem('forge:project'); if (ls) { try { setP(JSON.parse(ls)); } catch {} }
    fetch('/api/project').then(r => r.json()).then(d => { if (d?.messages) setP(d); loaded.current = true; }).catch(() => (loaded.current = true)); }, []);
  useEffect(() => { if (loaded.current) { try { localStorage.setItem('forge:project', JSON.stringify(p)); } catch {} } if (loaded.current) fetch('/api/project', { method: 'POST', body: JSON.stringify(p) }); endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [p]);

  const addFiles = async (fl: FileList | File[]) => { const a = await Promise.all(Array.from(fl).map(readFile)); setAtts(x => [...x, ...a]); };
  const onPaste = (e: React.ClipboardEvent) => { const fs = Array.from(e.clipboardData.files); if (fs.length) { e.preventDefault(); addFiles(fs); } };
  const send = (text = input) => {
    if (!text.trim() && !atts.length) return;
    const msg: Msg = { role: 'user', text, atts }; const imgs = atts.filter(a => a.type.startsWith('image/')).map(a => a.url);
    setInput(''); setAtts([]); setBusy(true);
    setP(cur => ({ ...cur, messages: [...cur.messages, msg] })); // can keep typing while it builds
    const say = (from: string, t: string) => setP(cur => ({ ...cur, messages: [...cur.messages, { role: 'forge', from, text: t }] }));
    const others = target.filter(t => t !== 'forge');
    others.forEach(t => { if (t === 'architect') say('Architect', architect(text)); else if (t === 'analyst') say('Analyst', analyst(p.files));
      else { const b = bots.find(x => x.id === t); if (b) callBot(b, text, p.files).then(r => say(b.name, r)).catch(e => say(b.name, `❌ ${e.message}`)); } });
    if (!target.includes('forge')) { setBusy(false); return; }
    setTimeout(() => {
      setP(cur => { const { spec, reply } = applyPrompt(cur.spec, text || 'add these images', imgs);
        const cps = [...(cur.checkpoints||[]), { at: new Date().toLocaleTimeString(), spec: cur.spec, files: cur.files }].slice(-20);
        return { spec, files: render(spec), checkpoints: cps, messages: [...cur.messages, { role: 'forge', text: reply }] }; });
      setBusy(false); setTab(t => t === 'code' ? t : 'preview');
    }, 450);
  };
  const setSpec = (spec: Spec) => setP(cur => ({ ...cur, spec, files: render(spec) }));
  const moveSection = (from: number, to: number) => { if (!p.spec) return; const s = [...p.spec.sections]; const [m] = s.splice(from, 1); s.splice(to, 0, m); setSpec({ ...p.spec, sections: s }); };
  const zip = async () => { const z = new JSZip(); Object.entries(p.files).forEach(([n, c]) => z.file(n, c));
    const blob = await z.generateAsync({ type: 'blob' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${(p.spec?.name || 'forge-project').replace(/\W+/g, '-').toLowerCase()}.zip`; a.click(); };
  const has = Object.keys(p.files).length > 0;

  return <div className={`app m-${mtab}`}>
    <header className="top" data-forge-path="top"><div className="logo"><span className="mark">◆</span> Forge</div>
      <div className="pname">{p.spec?.name || 'Untitled project'}</div>
      <div className="right"><span className="badge">● Powered by your plan</span>
        <button className="ghost" data-forge-path="top/undo" disabled={!p.checkpoints?.length} title="Restore last checkpoint" onClick={() => setP(cur => { const cps = [...(cur.checkpoints||[])]; const c = cps.pop(); return c ? { ...cur, spec: c.spec, files: c.files, checkpoints: cps, messages: [...cur.messages, { role: 'forge', text: `Restored checkpoint from ${c.at}.` }] } : cur; })}>↶ Undo ({p.checkpoints?.length||0})</button>
        <button className="ghost" onClick={() => { if (confirm('Start a new project?')) setP({ spec: null, files: {}, messages: [{ role: 'forge', text: 'Fresh start. What are we building?' }] }); }}>New</button>
        <button className="primary" disabled={!has} onClick={() => setPublish(true)}>Publish</button></div></header>
    <main className="body">
      <aside className="chat" data-forge-path="chat" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); addFiles(e.dataTransfer.files); }}>
        <div className="msgs">{p.messages.map((m, i) => <div key={i} className={`msg ${m.role}`}>
          {m.atts?.length ? <div className="atts">{m.atts.map((a, j) => a.type.startsWith('image/') ? <img key={j} src={a.url} title={a.name} /> : <span key={j} className="chip">📎 {a.name}</span>)}</div> : null}
          {m.from && <div className="from">{m.from}</div>}{m.text && <div dangerouslySetInnerHTML={{ __html: md(m.text) }} />}</div>)}
          {busy && <div className="msg forge typing">Building…</div>}
          {!p.spec && <div className="starters">{STARTERS.map(([l, t]) => <button key={l} onClick={() => send(t)}>{l}</button>)}</div>}
          <div ref={endRef} /></div>
        <div className="composer">
          {atts.length > 0 && <div className="atts pending">{atts.map((a, i) => <div key={i} className="th">{a.type.startsWith('image/') ? <img src={a.url} /> : <span className="chip">📎 {a.name}</span>}<button onClick={() => setAtts(x => x.filter((_, j) => j !== i))}>×</button></div>)}</div>}
          <div className="targets">{[['forge','◆ Forge'],['architect','📐 Architect'],['analyst','🔍 Analyst'],...bots.map(b => [b.id, '🤖 ' + b.name])].map(([id, l]) => <button key={id} className={target.includes(id) ? 'on' : ''} onClick={() => setTarget(t => t.includes(id) ? (t.length > 1 ? t.filter(x => x !== id) : t) : [...t, id])}>{l}</button>)}</div>
          <textarea value={input} placeholder="Describe your app… (paste images with ⌘V)" onPaste={onPaste} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
          <div className="row"><button className="ghost icon" title="Attach files" onClick={() => fileRef.current?.click()}>📎</button>
            <input ref={fileRef} type="file" multiple hidden onChange={e => { e.target.files && addFiles(e.target.files); e.target.value = ''; }} />
            <button className="primary" onClick={() => send()}>Send ↵</button></div></div>
      </aside>
      <section className="stage" data-forge-path="stage">
        <div className="tabs" data-forge-path="stage/tabs">{(['preview', 'code', 'canvas', 'bots'] as const).map(t => <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t[0].toUpperCase() + t.slice(1)}</button>)}
          {tab === 'preview' && <span className="devices">{(['desktop','tablet','mobile'] as const).map(d => <button key={d} className={device === d ? 'on' : ''} onClick={() => setDevice(d)}>{d === 'desktop' ? '🖥' : d === 'tablet' ? '▭' : '📱'} {d}</button>)}</span>}</div>
        {tab === 'bots' ? <div className="bots"><p className="hint">Connect bots by URL. Tokens stay in this browser only. Bots can call Forge tools: forge_architect, forge_analyst. Tap names under the chat box to route or broadcast.</p>
            {bots.map(b => <div key={b.id} className="scard"><b>{b.name}</b><small>{b.role} · {b.kind}</small><span className="acts"><button onClick={async () => { setTst(x => ({ ...x, [b.id]: '…' })); const r = await testBot(b); setTst(x => ({ ...x, [b.id]: r })); }}>Test</button><button onClick={() => setEdit(b)}>Edit</button><button onClick={() => { setBots(x => x.filter(y => y.id !== b.id)); setTarget(t => t.filter(y => y !== b.id).length ? t.filter(y => y !== b.id) : ['forge']); }}>✕</button></span>{tst[b.id] && <div className="tst">{tst[b.id]}</div>}</div>)}
            {edit ? <form className="botform" onSubmit={e => { e.preventDefault(); setBots(x => x.some(y => y.id === edit.id) ? x.map(y => y.id === edit.id ? edit : y) : [...x, edit]); setEdit(null); }}>
              <input required aria-label="Name" placeholder="Name" value={edit.name} onChange={e => setEdit({ ...edit, name: e.target.value })} />
              <input aria-label="Role" placeholder="Role (e.g. copywriter)" value={edit.role} onChange={e => setEdit({ ...edit, role: e.target.value })} />
              <select aria-label="Type" value={edit.kind} onChange={e => setEdit({ ...edit, kind: e.target.value as Bot['kind'] })}><option value="webhook">Webhook</option><option value="openai">OpenAI-compatible</option><option value="mcp">MCP (HTTP)</option></select>
              <input required type="url" aria-label="Endpoint URL" placeholder="https://…" value={edit.url} onChange={e => setEdit({ ...edit, url: e.target.value })} />
              {edit.kind === 'openai' && <input aria-label="Model" placeholder="Model name (optional)" value={edit.model || ''} onChange={e => setEdit({ ...edit, model: e.target.value })} />}
              <input type="password" aria-label="Token" placeholder="Token (optional, stored locally)" value={edit.token || ''} onChange={e => setEdit({ ...edit, token: e.target.value })} />
              <div className="row"><button type="button" className="ghost" onClick={() => setEdit(null)}>Cancel</button><button className="primary">Save</button></div></form>
            : <button className="primary" onClick={() => setEdit({ id: 'b' + Date.now(), name: '', role: '', url: '', kind: 'webhook' })}>+ Add bot</button>}</div>
        : !has ? <div className="empty"><div className="mark big">◆</div><h2>Your app appears here</h2><p>Send a prompt or pick a starter on the left.</p></div>
        : tab === 'preview' ? <div className="pwrap"><iframe data-forge-path="stage/preview" className={`preview ${device}`} title="preview" sandbox="allow-scripts allow-forms" srcDoc={bundle(p.files)} /></div>
        : tab === 'code' ? <div className="code"><ul>{Object.keys(p.files).map(f => <li key={f} className={f === file ? 'on' : ''} onClick={() => setFile(f)}>{f}</li>)}</ul>
            <textarea spellCheck={false} value={p.files[file] || ''} onChange={e => { const v = e.target.value; setP(cur => ({ ...cur, files: { ...cur.files, [file]: v } })); }} /></div>
        : <CanvasBoard sections={p.spec?.sections || []} onReorder={moveSection} onRemoveSection={id => setSpec({ ...p.spec!, sections: p.spec!.sections.filter(x => x.id !== id) })} />}
      </section>
    </main>
    <nav className="mnav">{(['chat','preview','code','canvas','bots'] as const).map(t => <button key={t} className={mtab === t ? 'on' : ''} onClick={() => { setMtab(t); if (t !== 'chat') setTab(t); }}>{t === 'chat' ? '💬' : t === 'preview' ? '👁' : t === 'code' ? '</>' : t === 'bots' ? '🤖' : '▦'}<small>{t[0].toUpperCase() + t.slice(1)}</small></button>)}</nav>
    {publish && <div className="sheetbg" onClick={() => setPublish(false)}><div className="sheet" onClick={e => e.stopPropagation()}>
      <h2>Publish {p.spec?.name}</h2><p>Download your project as a ZIP (index.html, styles.css, app.js). It's plain static files — unzip and drag the folder onto Vercel (vercel.com/new → drag-drop), Netlify Drop (app.netlify.com/drop), GitHub Pages, or Cloudflare Pages (all free) to get a shareable link.</p>
      <div className="row"><button className="ghost" onClick={() => setPublish(false)}>Close</button><button className="primary" onClick={zip}>Download ZIP</button></div></div></div>}
  </div>;
}

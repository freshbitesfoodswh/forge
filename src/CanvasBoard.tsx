import { useEffect, useRef, useState } from 'react';

export type CItem = {
  id: string; kind: 'frame' | 'note';
  x: number; y: number; w?: number; h?: number;
  text: string; color?: string;
};

type Props = {
  sections: { id: string; kind: string }[];
  onReorder: (from: number, to: number) => void;
  onRemoveSection: (id: string) => void;
};

export default function CanvasBoard({ sections, onReorder, onRemoveSection }: Props) {
  const [items, setItems] = useState<CItem[]>(() => {
    try { return JSON.parse(localStorage.getItem('forge:canvas') || '[]'); } catch { return []; }
  });
  const [tool, setTool] = useState<'pan' | 'note' | 'draw'>('pan');
  const [view, setView] = useState({ x: 40, y: 40, s: 1 });
  const [dragSec, setDragSec] = useState<number | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const ink = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    try { localStorage.setItem('forge:canvas', JSON.stringify(items)); } catch {}
  }, [items]);

  const framesFromSections = () => {
    setItems(cur => [
      ...cur,
      ...sections.map((s, i) => ({
        id: 'f' + s.id + Date.now() + i,
        kind: 'frame' as const,
        x: 60 + (i % 3) * 280,
        y: 60 + Math.floor(i / 3) * 220,
        w: 250, h: 180,
        text: s.kind,
      })),
    ]);
  };

  const onBoardDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('.citem')) return;
    const r = wrap.current!.getBoundingClientRect();
    if (tool === 'note') {
      const x = (e.clientX - r.left - view.x) / view.s;
      const y = (e.clientY - r.top - view.y) / view.s;
      setItems(cur => [...cur, { id: 'n' + Date.now(), kind: 'note', x, y, w: 160, h: 120, text: 'Note…', color: '#ffe08a' }]);
      return;
    }
    if (tool === 'draw') {
      const c = ink.current!;
      const ctx = c.getContext('2d')!;
      ctx.strokeStyle = '#2DD4BF';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      let last = {
        x: (e.clientX - r.left - view.x) / view.s,
        y: (e.clientY - r.top - view.y) / view.s,
      };
      const move = (ev: PointerEvent) => {
        const p = {
          x: (ev.clientX - r.left - view.x) / view.s,
          y: (ev.clientY - r.top - view.y) / view.s,
        };
        ctx.beginPath();
        ctx.moveTo(last.x, last.y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        last = p;
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      return;
    }
    const ox = e.clientX - view.x;
    const oy = e.clientY - view.y;
    const move = (ev: PointerEvent) => setView(v => ({ ...v, x: ev.clientX - ox, y: ev.clientY - oy }));
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const startItemDrag = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const ox = (e.clientX - r.left) / view.s;
    const oy = (e.clientY - r.top) / view.s;
    const move = (ev: PointerEvent) => {
      const br = wrap.current!.getBoundingClientRect();
      const nx = (ev.clientX - br.left - view.x) / view.s - ox;
      const ny = (ev.clientY - br.top - view.y) / view.s - oy;
      setItems(cur => cur.map(x => (x.id === id ? { ...x, x: nx, y: ny } : x)));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <div className="canvas board-mode">
      <div className="ctools">
        <button className={tool === 'pan' ? 'on' : ''} onClick={() => setTool('pan')}>Pan</button>
        <button className={tool === 'note' ? 'on' : ''} onClick={() => setTool('note')}>Sticky</button>
        <button className={tool === 'draw' ? 'on' : ''} onClick={() => setTool('draw')}>Draw</button>
        <button onClick={framesFromSections}>Frames from sections</button>
        <button onClick={() => setItems(cur => [...cur, { id: 'n' + Date.now(), kind: 'note', x: 120, y: 120, w: 160, h: 120, text: 'Note…', color: '#ffe08a' }])}>+ Note</button>
        <button onClick={() => { const c = ink.current; if (c) c.getContext('2d')!.clearRect(0, 0, c.width, c.height); }}>Clear ink</button>
      </div>
      <div className="sec-rail">
        <p className="hint">Sections (drag to reorder → updates preview)</p>
        {sections.map((s, i) => (
          <div
            key={s.id}
            draggable
            className={`scard ${dragSec === i ? 'drag' : ''}`}
            onDragStart={() => setDragSec(i)}
            onDragOver={e => e.preventDefault()}
            onDrop={() => { if (dragSec !== null) onReorder(dragSec, i); setDragSec(null); }}
          >
            <span className="grip">⋮⋮</span>
            <b>{s.kind}</b>
            <span className="acts">
              <button disabled={i === 0} onClick={() => onReorder(i, i - 1)}>↑</button>
              <button disabled={i === sections.length - 1} onClick={() => onReorder(i, i + 1)}>↓</button>
              <button onClick={() => onRemoveSection(s.id)}>✕</button>
            </span>
          </div>
        ))}
      </div>
      <div
        className="board-wrap"
        ref={wrap}
        onWheel={e => {
          e.preventDefault();
          const old = view.s;
          const ns = Math.min(2.2, Math.max(0.4, view.s * (e.deltaY > 0 ? 0.9 : 1.1)));
          const r = wrap.current!.getBoundingClientRect();
          const mx = e.clientX - r.left;
          const my = e.clientY - r.top;
          setView({ s: ns, x: mx - (mx - view.x) * (ns / old), y: my - (my - view.y) * (ns / old) });
        }}
        onPointerDown={onBoardDown}
      >
        <div className="board" style={{ transform: `translate(${view.x}px,${view.y}px) scale(${view.s})` }}>
          <canvas ref={ink} className="ink" width={3000} height={2000} />
          {items.map(it => (
            <div
              key={it.id}
              className={`citem ${it.kind}`}
              style={{ left: it.x, top: it.y, width: it.w, height: it.h, background: it.kind === 'note' ? it.color : undefined }}
              onPointerDown={e => startItemDrag(e, it.id)}
            >
              {it.kind === 'frame' ? (
                <>
                  <div className="flabel">{it.text}</div>
                  <div className="fbody">Design frame</div>
                </>
              ) : (
                <div
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={e => setItems(cur => cur.map(x => (x.id === it.id ? { ...x, text: (e.target as HTMLElement).innerText } : x)))}
                  onPointerDown={e => e.stopPropagation()}
                >
                  {it.text}
                </div>
              )}
              <button className="x" onClick={() => setItems(cur => cur.filter(x => x.id !== it.id))}>✕</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

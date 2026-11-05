// Forge local builder agent — deterministic, no external LLM.
export type SectionKind = 'nav'|'hero'|'links'|'features'|'stats'|'form'|'posts'|'testimonials'|'pricing'|'contact'|'cta'|'footer';
export interface Section { id: string; kind: SectionKind; }
export interface Spec {
  template: 'landing'|'dashboard'|'waitlist'|'blog'|'linkbio';
  name: string; tagline: string; accent: string; theme: 'dark'|'light';
  topic: string; buttonColor?: string; sections: Section[]; images: string[];
}
const uid = () => Math.random().toString(36).slice(2, 8);
const S = (k: SectionKind): Section => ({ id: uid(), kind: k });
const COLORS: Record<string,string> = { teal:'#2DD4BF', violet:'#8B5CF6', purple:'#8B5CF6', blue:'#3B82F6', green:'#34D399', red:'#F87171', orange:'#FB923C', pink:'#F472B6', yellow:'#FBBF24', gold:'#FBBF24', black:'#111827', white:'#FFFFFF' };
const LAYOUTS: Record<Spec['template'], SectionKind[]> = {
  landing: ['nav','hero','features','testimonials','cta','footer'],
  waitlist: ['nav','hero','form','features','footer'],
  dashboard: ['nav','stats','features','footer'],
  blog: ['nav','hero','posts','footer'],
  linkbio: ['hero','links','footer'],
};
const TOPICS: [RegExp,string,string][] = [
  [/wellness|spirit|yoga|meditat|mindful/i,'Wellness','Find your calm. Grow every day.'],
  [/fitness|gym|workout/i,'Fitness','Stronger every rep.'],
  [/food|restaurant|recipe|cafe/i,'Kitchen','Good food, made simple.'],
  [/finance|money|budget/i,'Finance','Your money, finally clear.'],
  [/job|career|resume/i,'Career','Land the role you deserve.'],
  [/ai|startup|saas|app/i,'Product','Ship faster with less friction.'],
];
export function newSpec(prompt: string): Spec {
  const p = prompt.toLowerCase();
  const template: Spec['template'] = /waitlist|early access|sign ?up list/.test(p) ? 'waitlist' : /dashboard|admin|analytics|metrics/.test(p) ? 'dashboard' : /blog|articles|posts|journal/.test(p) ? 'blog' : /link.?in.?bio|linktree|bio links/.test(p) ? 'linkbio' : 'landing';
  const t = TOPICS.find(([r]) => r.test(prompt));
  const named = prompt.match(/(?:called|named)\s+["']?([\w\s]{2,30}?)["']?(?:[.,]|$| that| with| for)/i);
  const topic = t ? t[1] : 'Studio';
  return { template, topic, name: named ? named[1].trim() : `${topic} ${template === 'blog' ? 'Journal' : template === 'dashboard' ? 'HQ' : 'Co.'}`,
    tagline: t ? t[2] : 'Something beautiful is coming.', accent: '#2DD4BF', theme: 'dark',
    sections: LAYOUTS[template].map(S), images: [] };
}
const isNew = (p: string) => /^(build|create|make me|generate|start)\b.*\b(page|site|app|landing|dashboard|blog|waitlist|bio)/i.test(p.trim());
// Returns updated spec + human explanation
export function applyPrompt(spec: Spec | null, prompt: string, images: string[]): { spec: Spec; reply: string } {
  if (!spec || isNew(prompt)) {
    const s = newSpec(prompt); s.images = images;
    const vague = prompt.trim().split(/\s+/).length < 4;
    return { spec: s, reply: `${vague ? "That was a little open-ended, so I made a polished starter. " : ''}Built a **${s.template}** page "${s.name}" with sections: ${s.sections.map(x=>x.kind).join(' → ')}.${images.length ? ` Used your ${images.length} image(s) in the hero.` : ''} Try: "make the button violet", "add a contact form", "light theme", "call it Bloom".` };
  }
  const s: Spec = JSON.parse(JSON.stringify(spec)); const done: string[] = []; const p = prompt.toLowerCase();
  const color = Object.keys(COLORS).find(c => p.includes(c)) || p.match(/#[0-9a-f]{6}/)?.[0];
  const hex = color ? (color.startsWith('#') ? color : COLORS[color]) : null;
  if (hex && /button|cta/.test(p)) { s.buttonColor = hex; done.push(`buttons → ${hex}`); }
  else if (hex && /accent|color|theme|brand|make it/.test(p)) { s.accent = hex; done.push(`accent → ${hex}`); }
  if (/light (theme|mode)|make it light|white background/.test(p)) { s.theme = 'light'; done.push('light theme'); }
  if (/dark (theme|mode)|make it dark/.test(p)) { s.theme = 'dark'; done.push('dark theme'); }
  const name = prompt.match(/(?:call it|rename (?:it )?to|name it|title(?: it)?)\s+["']?([^"'.]{2,40})/i);
  if (name) { s.name = name[1].trim(); done.push(`renamed to "${s.name}"`); }
  const tag = prompt.match(/(?:tagline|headline|subtitle)(?: to| is|:)?\s+["']?([^"']{3,80})/i);
  if (tag) { s.tagline = tag[1].trim(); done.push('new headline'); }
  const add: [RegExp, SectionKind][] = [[/contact/, 'contact'],[/pricing|price/, 'pricing'],[/testimonial|review/, 'testimonials'],[/feature/, 'features'],[/stat|metric|kpi/, 'stats'],[/blog|post/, 'posts'],[/form|waitlist|signup|sign up/, 'form'],[/cta|call to action/, 'cta']];
  for (const [r,k] of add) {
    if (r.test(p) && /\b(add|include|put|need|want)\b/.test(p) && !s.sections.some(x=>x.kind===k)) {
      const fi = s.sections.findIndex(x=>x.kind==='footer'); s.sections.splice(fi<0?s.sections.length:fi,0,S(k)); done.push(`added ${k}`); }
    if (r.test(p) && /\b(remove|delete|drop|no more)\b/.test(p)) { s.sections = s.sections.filter(x=>x.kind!==k); done.push(`removed ${k}`); }
  }
  if (images.length) { s.images = [...images, ...s.images].slice(0,6); done.push(`placed ${images.length} image(s)`); }
  if (!done.length) return { spec: s, reply: `I'm a local builder, so I understand edits like: "make the button teal", "add a contact form / pricing / testimonials", "remove features", "light theme", "call it Bloom", "headline: …", or "build a blog about …". Paste an image to drop it in the hero. You can also edit files directly in the Code tab.` };
  return { spec: s, reply: `Done: ${done.join(', ')}.` };
}
const esc = (t: string) => t.replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]!));
function section(s: Spec, k: SectionKind): string {
  const n = esc(s.name), img = s.images[0];
  switch (k) {
    case 'nav': return `<nav class="nav"><b>${n}</b><div><a href="#features">Features</a><a href="#cta" class="btn sm">Get started</a></div></nav>`;
    case 'hero': return `<header class="hero"><div><span class="pill">${esc(s.topic)}</span><h1>${esc(s.tagline)}</h1><p>${n} helps you show up for what matters — simple, beautiful, and built for real life.</p><a class="btn" href="#cta">${s.template==='waitlist'?'Join the waitlist':'Get started'}</a></div>${img?`<img class="heroimg" src="${img}" alt=""/>`:`<div class="orb"></div>`}</header>`;
    case 'features': return `<section id="features" class="grid3">${[['✦','Daily rituals','Small steps that compound.'],['◎','Guided insight','Clarity when you need it.'],['❋','Community','Grow alongside others.']].map(([i,t,d])=>`<div class="card"><div class="ic">${i}</div><h3>${t}</h3><p>${d}</p></div>`).join('')}</section>`;
    case 'stats': return `<section class="grid4">${[['Active users','12,480','+8%'],['Revenue','$48.2k','+12%'],['Sessions','93.1k','+3%'],['Churn','1.9%','-0.4%']].map(([l,v,d])=>`<div class="card"><p>${l}</p><h2>${v}</h2><span class="delta">${d}</span></div>`).join('')}<div class="card wide"><p>Weekly activity</p><div class="bars">${[40,65,50,80,70,95,60].map(h=>`<i style="height:${h}%"></i>`).join('')}</div></div></section>`;
    case 'form': return `<section id="cta" class="card formcard"><h2>Get early access</h2><p>Be first in line. No spam, ever.</p><form onsubmit="event.preventDefault();this.innerHTML='<h3>🎉 You\\'re on the list!</h3>'"><input type="email" required placeholder="you@email.com"/><button class="btn">Join waitlist</button></form><small id="count">1,204 people already joined</small></section>`;
    case 'posts': return `<section class="grid3">${['Starting where you are','The 5-minute morning reset','What gratitude actually does'].map((t,i)=>`<article class="card">${s.images[i]?`<img src="${s.images[i]}"/>`:'<div class="thumb"></div>'}<small>${['Mar 4','Feb 21','Feb 2'][i]} · 4 min</small><h3>${t}</h3><p>A short read on building habits that last.</p></article>`).join('')}</section>`;
    case 'testimonials': return `<section class="grid3">${['“Changed my mornings.” — Ava','“Simple and beautiful.” — Marcus','“I finally stick with it.” — Jo'].map(q=>`<blockquote class="card">${q}</blockquote>`).join('')}</section>`;
    case 'pricing': return `<section class="grid3">${[['Free','$0'],['Plus','$9'],['Pro','$19']].map(([t,p],i)=>`<div class="card ${i===1?'hl':''}"><h3>${t}</h3><h2>${p}<small>/mo</small></h2><a class="btn">Choose</a></div>`).join('')}</section>`;
    case 'contact': return `<section class="card formcard"><h2>Contact us</h2><form onsubmit="event.preventDefault();this.innerHTML='<h3>Thanks! We\\'ll be in touch.</h3>'"><input required placeholder="Name"/><input type="email" required placeholder="Email"/><textarea placeholder="Message"></textarea><button class="btn">Send</button></form></section>`;
    case 'cta': return `<section id="cta" class="ctaband"><h2>Ready to begin?</h2><a class="btn">Start free</a></section>`;
    case 'links': return `<section class="links">${['My latest drop','Book a session','Newsletter','Follow on X'].map(t=>`<a class="card linkbtn" href="#">${t}</a>`).join('')}</section>`;
    case 'footer': return `<footer>© ${new Date().getFullYear()} ${n}</footer>`;
  }
}
export function render(s: Spec): Record<string,string> {
  const L = s.theme === 'light';
  const css = `:root{--bg:${L?'#F8FAFC':'#0B0F14'};--panel:${L?'#FFFFFF':'#121820'};--text:${L?'#0F172A':'#E8EEF5'};--muted:${L?'#64748B':'#8B9BB0'};--border:${L?'#E2E8F0':'#2A3544'};--accent:${s.accent};--btn:${s.buttonColor||s.accent}}
*{box-sizing:border-box}body{margin:0;font-family:Inter,system-ui,sans-serif;background:var(--bg);color:var(--text);line-height:1.5}
a{color:inherit;text-decoration:none}section,header,nav,footer{max-width:1080px;margin:0 auto;padding:32px 24px}
.nav{display:flex;justify-content:space-between;align-items:center}.nav a{margin-left:18px;color:var(--muted)}.nav a.btn{color:#0B0F14}
.btn{display:inline-block;background:var(--btn);color:#0B0F14;font-weight:600;padding:12px 22px;border-radius:12px;border:0;cursor:pointer;font-size:15px}.btn.sm{padding:8px 14px}
.hero{display:grid;grid-template-columns:1.2fr 1fr;gap:40px;align-items:center;padding-top:64px;padding-bottom:64px}
.hero h1{font-size:52px;line-height:1.05;margin:16px 0}.hero p{color:var(--muted);font-size:18px}
.pill{border:1px solid var(--border);border-radius:99px;padding:4px 12px;font-size:13px;color:var(--accent)}
.orb{aspect-ratio:1;border-radius:50%;background:radial-gradient(circle at 30% 30%,var(--accent),#8B5CF6 60%,transparent 70%);filter:blur(2px);opacity:.85}
.heroimg{width:100%;border-radius:16px;border:1px solid var(--border)}
.grid3,.grid4{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.grid4{grid-template-columns:repeat(4,1fr)}
.card{background:var(--panel);border:1px solid var(--border);border-radius:12px;padding:22px}.card p{color:var(--muted);margin:4px 0}.card h2{margin:6px 0}
.card.hl{border-color:var(--accent)}.card img,.thumb{width:100%;height:140px;object-fit:cover;border-radius:8px;background:linear-gradient(135deg,var(--accent),#8B5CF6);margin-bottom:10px}
.wide{grid-column:1/-1}.bars{display:flex;gap:10px;align-items:flex-end;height:140px}.bars i{flex:1;background:var(--accent);border-radius:6px 6px 0 0;opacity:.8}
.delta{color:#34D399;font-size:13px}.ic{font-size:22px;color:var(--accent)}
.formcard{max-width:520px;text-align:center}.formcard form{display:flex;flex-direction:column;gap:10px;margin:16px 0}
input,textarea{background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:10px;padding:12px;font:inherit}
.ctaband{text-align:center;background:linear-gradient(135deg,color-mix(in srgb,var(--accent) 25%,transparent),transparent);border-radius:16px}
footer{color:var(--muted);text-align:center;font-size:14px}
.card{backdrop-filter:blur(14px);background:color-mix(in srgb,var(--panel) 70%,transparent);box-shadow:0 0 0 1px color-mix(in srgb,var(--accent) 12%,transparent),0 10px 40px -20px var(--accent)}
.btn{box-shadow:0 0 24px -4px var(--btn)}.hero h1{background:linear-gradient(120deg,var(--text),var(--accent) 60%,#8B5CF6);-webkit-background-clip:text;color:transparent}
body{background-image:radial-gradient(900px 500px at 85% -10%,color-mix(in srgb,var(--accent) 18%,transparent),transparent),radial-gradient(700px 400px at -10% 110%,rgba(139,92,246,.18),transparent)}
.links{max-width:480px;display:flex;flex-direction:column;gap:12px}.linkbtn{text-align:center;font-weight:600}.linkbtn:hover{border-color:var(--accent)}
@media(max-width:720px){.hero,.grid3,.grid4{grid-template-columns:1fr}.hero h1{font-size:36px}}`;
  const html = `<!doctype html>\n<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${esc(s.name)}</title><link rel="stylesheet" href="styles.css"/></head>\n<body>\n${s.sections.map(x=>`<!-- section:${x.kind} -->\n`+section(s,x.kind).replace(/^<(\w+)/,`<$1 data-forge-path="section/${x.kind}/${x.id}"`)).join('\n')}\n<script src="app.js"></script>\n</body></html>`;
  const js = `// ${s.name} — generated by Forge\ndocument.querySelectorAll('a[href^="#"]').forEach(a=>a.addEventListener('click',e=>{const t=document.querySelector(a.getAttribute('href'));if(t){e.preventDefault();t.scrollIntoView({behavior:'smooth'})}}));\n`;
  return { 'index.html': html, 'styles.css': css, 'app.js': js };
}
// Inline styles.css + app.js for the iframe preview
export function bundle(files: Record<string,string>): string {
  return (files['index.html']||'').replace('<link rel="stylesheet" href="styles.css"/>', `<style>${files['styles.css']||''}</style>`)
    .replace('<script src="app.js"></script>', `<script>${files['app.js']||''}<\/script>`);
}

// Local, rule-based agents. No paid APIs, no keys.
export type Role = 'forge'|'architect'|'analyst'|string;
const has = (t: string, ...w: string[]) => w.some(x => t.includes(x));
export function architect(prompt: string): string {
  const t = prompt.toLowerCase();
  const kind = has(t,'dashboard','analytics','admin') ? 'dashboard' : has(t,'shop','store','ecommerce','product') ? 'store' : has(t,'blog','post','article') ? 'blog' : has(t,'bio','link') ? 'link-in-bio' : 'landing';
  const P: Record<string,string[]> = { dashboard:['Overview','Reports','Settings','Login'], store:['Home','Catalog','Product','Cart','Checkout'], blog:['Home','Post','Archive','About'], 'link-in-bio':['Profile'], landing:['Home','Pricing','Waitlist'] };
  const C: Record<string,string[]> = { dashboard:['Sidebar','KpiCard','Chart','DataTable','Filters'], store:['ProductCard','CartDrawer','PriceTag','CheckoutForm'], blog:['PostCard','PostBody','Tags','Newsletter'], 'link-in-bio':['Avatar','LinkButton','SocialRow'], landing:['Hero','Features','Testimonials','Pricing','CTA','Footer'] };
  const D: Record<string,string> = { dashboard:'Metric{id,name,value,ts} · User{id,email,role}', store:'Product{id,title,price,img,stock} · CartItem{productId,qty} · Order{id,items,total,status}', blog:'Post{id,slug,title,body,tags[],date} · Subscriber{email}', 'link-in-bio':'Link{id,label,url,order} · Profile{name,bio,avatar}', landing:'Lead{email,createdAt} · Plan{name,price,features[]}' };
  const pages = P[kind], comps = C[kind];
  const risks = ['No secrets in client code — use env/server proxy', 'Alt text + labels on every image/input (a11y)', 'Title, meta description, OG tags (SEO)'];
  if (has(t,'login','auth','account')) risks.push('Auth: hash passwords server-side, never store tokens in code');
  if (has(t,'pay','checkout','stripe')) risks.push('Payments: hosted checkout only; never handle raw card data');
  if (has(t,'image','photo','upload')) risks.push('Uploads: size/type limits, lazy-load images');
  return `**Architect plan — ${kind}**
**Goal:** ${prompt.trim()}
**Pages:** ${pages.join(', ')}
**Components:** ${comps.join(', ')}
**Data model:** ${D[kind]}
**Routes:** ${pages.map(p => p === 'Home' || p === 'Profile' || p === 'Overview' ? '/' : '/' + p.toLowerCase()).join('  ')}
**State:** UI state local (useState); shared data in a store/context; persist to localStorage; server data via fetch hooks.
**File tree:**
src/
  pages/ ${pages.map(p => p + '.tsx').join(' ')}
  components/ ${comps.map(c => c + '.tsx').join(' ')}
  data/models.ts · lib/api.ts · styles.css
**Risks:** ${risks.map(r => '\n• ' + r).join('')}
**Steps:** 1) scaffold pages  2) build components  3) wire data  4) a11y/SEO pass  5) Analyst review  6) publish.
Reply "build it" to generate.`;
}
interface F { area: string; sev: 'high'|'med'|'low'; msg: string; fix: string }
export function analyst(files: Record<string,string>): string {
  const all = Object.values(files).join('\n'); if (!all.trim()) return '**Analyst:** nothing to review yet — build something first.';
  const html = files['index.html'] || all; const f: F[] = [];
  const imgs = html.match(/<img\b[^>]*>/gi) || []; const noAlt = imgs.filter(i => !/alt=/i.test(i)).length;
  if (noAlt) f.push({ area:'a11y', sev:'high', msg:`${noAlt} image(s) missing alt`, fix:'Add descriptive alt="" text.' });
  if (!/<html[^>]*lang=/i.test(html)) f.push({ area:'a11y', sev:'med', msg:'No lang on <html>', fix:'<html lang="en">' });
  const inputs = (html.match(/<input\b[^>]*>/gi) || []).filter(i => !/aria-label|id=/i.test(i)).length;
  if (inputs) f.push({ area:'a11y', sev:'med', msg:`${inputs} input(s) without label`, fix:'Add <label for> or aria-label.' });
  if (!/<h1/i.test(html)) f.push({ area:'a11y', sev:'low', msg:'No <h1>', fix:'One clear <h1> per page.' });
  if (!/<title>[^<]+/i.test(html)) f.push({ area:'seo', sev:'high', msg:'Missing <title>', fix:'Add a 50–60 char title.' });
  if (!/name=["']description/i.test(html)) f.push({ area:'seo', sev:'med', msg:'No meta description', fix:'Add 150-char meta description.' });
  if (!/og:title/i.test(html)) f.push({ area:'seo', sev:'low', msg:'No Open Graph tags', fix:'Add og:title/og:description/og:image.' });
  if (!/name=["']viewport/i.test(html)) f.push({ area:'perf', sev:'med', msg:'No viewport meta', fix:'<meta name="viewport" content="width=device-width,initial-scale=1">' });
  const big = (all.match(/data:image\/[^"')]{200000,}/g) || []).length;
  if (big) f.push({ area:'perf', sev:'med', msg:`${big} large inline image(s)`, fix:'Compress / host images, use loading="lazy".' });
  if (imgs.length && !imgs.some(i => /loading=/i.test(i))) f.push({ area:'perf', sev:'low', msg:'Images not lazy-loaded', fix:'loading="lazy" below the fold.' });
  const secret = /(sk-[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{20,}|xox[bp]-[A-Za-z0-9-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY|(api[_-]?key|secret|password)\s*[:=]\s*["'][^"']{8,})/i;
  if (secret.test(all)) f.push({ area:'security', sev:'high', msg:'Possible secret/API key in code', fix:'Remove it, rotate the key, load via server env.' });
  if (/eval\(|innerHTML\s*=/.test(all)) f.push({ area:'security', sev:'med', msg:'eval/innerHTML use', fix:'Use textContent or sanitize input.' });
  if (/http:\/\//.test(all)) f.push({ area:'security', sev:'low', msg:'Insecure http:// URLs', fix:'Use https://.' });
  const lines = all.split('\n').length, kb = Math.round(all.length / 1024);
  if (lines > 1500) f.push({ area:'complexity', sev:'med', msg:`${lines} lines in ${Object.keys(files).length} files`, fix:'Split into components/modules.' });
  const w = { high: 15, med: 7, low: 3 }; const score = (a: string) => Math.max(0, 100 - f.filter(x => x.area === a).reduce((s, x) => s + w[x.sev], 0));
  const areas = ['a11y','seo','perf','security','complexity'];
  const overall = Math.round(areas.reduce((s, a) => s + score(a), 0) / areas.length);
  return `**Analyst review — ${overall}/100** (${kb} KB, ${lines} lines)
${areas.map(a => `${a}: ${score(a)}`).join(' · ')}
${f.length ? f.map(x => `\n• [${x.sev}] ${x.area}: ${x.msg} → ${x.fix}`).join('') : '\nNo issues found. ✅'}`;
}

// ---- Bot connections (tokens live only in this browser's localStorage) ----
export interface Bot { id: string; name: string; role: string; url: string; kind: 'webhook'|'openai'|'mcp'; model?: string; token?: string }
const KEY = 'forge:bots';
export const loadBots = (): Bot[] => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } };
export const saveBots = (b: Bot[]) => localStorage.setItem(KEY, JSON.stringify(b));
export const TOOLS = [
  { name: 'forge_architect', description: 'Turn a prompt into a structured app plan', parameters: { type: 'object', properties: { prompt: { type: 'string' } }, required: ['prompt'] } },
  { name: 'forge_analyst', description: 'Review the current Forge project (a11y, SEO, perf, security, complexity)', parameters: { type: 'object', properties: {} } },
];
export function runTool(name: string, args: any, files: Record<string,string>) {
  return name === 'forge_architect' ? architect(String(args?.prompt || '')) : name === 'forge_analyst' ? analyst(files) : `Unknown tool ${name}`;
}
const hdr = (b: Bot) => ({ 'Content-Type': 'application/json', ...(b.token ? { Authorization: `Bearer ${b.token}` } : {}) });
export async function callBot(b: Bot, text: string, files: Record<string,string>): Promise<string> {
  if (b.kind === 'openai') {
    const url = b.url.replace(/\/$/, '') + (/chat\/completions$/.test(b.url) ? '' : '/chat/completions');
    const messages: any[] = [{ role: 'system', content: `You are ${b.name}, role: ${b.role}, inside the Forge app builder.` }, { role: 'user', content: text }];
    for (let i = 0; i < 3; i++) {
      const r = await fetch(url, { method: 'POST', headers: hdr(b), body: JSON.stringify({ model: b.model || 'default', messages, tools: TOOLS.map(t => ({ type: 'function', function: t })) }) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const m = (await r.json()).choices?.[0]?.message; if (!m) return '(empty reply)';
      if (!m.tool_calls?.length) return m.content || '(empty reply)';
      messages.push(m);
      for (const c of m.tool_calls) { let a = {}; try { a = JSON.parse(c.function.arguments || '{}'); } catch {} messages.push({ role: 'tool', tool_call_id: c.id, content: runTool(c.function.name, a, files) }); }
    }
    return '(tool loop limit)';
  }
  if (b.kind === 'mcp') {
    const r = await fetch(b.url, { method: 'POST', headers: { ...hdr(b), Accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method: 'tools/call', params: { name: 'chat', arguments: { message: text, forge_tools: TOOLS } } }) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`); const j = await r.json().catch(() => null);
    return j?.result?.content?.map((c: any) => c.text).join('\n') || JSON.stringify(j?.result ?? j);
  }
  const r = await fetch(b.url, { method: 'POST', headers: hdr(b), body: JSON.stringify({ message: text, bot: b.name, role: b.role, tools: TOOLS, project: Object.keys(files) }) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`); const ct = r.headers.get('content-type') || '';
  if (ct.includes('json')) { const j = await r.json(); if (j.tool) return runTool(j.tool, j.args, files); return j.reply || j.text || j.message || JSON.stringify(j); }
  return r.text();
}
export async function testBot(b: Bot): Promise<string> {
  try { const u = b.kind === 'openai' ? b.url.replace(/\/(chat\/completions)?$/, '') + '/models' : b.url;
    const r = await fetch(u, { method: b.kind === 'openai' ? 'GET' : 'POST', headers: hdr(b), body: b.kind === 'openai' ? undefined : JSON.stringify(b.kind === 'mcp' ? { jsonrpc: '2.0', id: 1, method: 'tools/list' } : { ping: true }) });
    return r.ok ? `✅ Connected (HTTP ${r.status})` : `⚠️ HTTP ${r.status}`; } catch (e: any) { return `❌ ${e.message} (check URL / CORS)`; }
}

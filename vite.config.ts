import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
const dir = path.resolve(__dirname, 'projects/default');
export default defineConfig({
  base: '/forge/',
  plugins: [react(), {
    name: 'forge-persist',
    configureServer(s) {
      s.middlewares.use('/api/project', (req, res) => {
        fs.mkdirSync(dir, { recursive: true });
        const f = path.join(dir, 'project.json');
        if (req.method === 'POST') {
          let b = ''; req.on('data', c => (b += c));
          req.on('end', () => {
            fs.writeFileSync(f, b);
            try { const p = JSON.parse(b); fs.mkdirSync(path.join(dir,'files'),{recursive:true});
              for (const [n,c] of Object.entries(p.files||{})) fs.writeFileSync(path.join(dir,'files',n), String(c)); } catch {}
            res.end('ok');
          });
        } else { res.setHeader('content-type','application/json'); res.end(fs.existsSync(f) ? fs.readFileSync(f) : 'null'); }
      });
    },
  }],
  server: { host: '0.0.0.0', port: 5174, strictPort: true, allowedHosts: true },
  preview: { host: "0.0.0.0", port: 5174, allowedHosts: true },
});

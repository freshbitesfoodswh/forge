# Forge
Our own Replit+Vibe-style app builder. 100% local — no API keys, no model picker, no credits.

## Run
```
export PATH=~/.local/bin:$(ls -d ~/.local/share/fnm/node-versions/v22*/installation/bin | head -1):$PATH
pnpm install && pnpm run dev   # → http://localhost:5174
```
## Use
- Chat (left): describe an app, or click a starter (Landing / Dashboard / Waitlist / Blog / Link-in-bio). Paste images (⌘V), drag-drop, or 📎 attach files.
- Follow-ups: "make the button violet", "add a contact form", "add pricing", "remove testimonials", "light theme", "call it Bloom", "headline: …".
- Preview / Code (editable) / Canvas (drag to reorder sections). Publish → Download ZIP.
- Project persists at `projects/default/project.json` (+ `files/`).

## Files
- `src/generator.ts` — the local builder agent (prompt → spec → HTML/CSS/JS). Extend rules here.
- `src/App.tsx` — the builder UI. `src/forge.css` — wardrobe.
- `vite.config.ts` — dev server + `/api/project` persistence.

- Device preview (Desktop/Tablet/Mobile), ↶ Undo restores checkpoints (saved before every build), localStorage + projects/default persistence, `data-forge-path` on UI + generated sections for future point-and-edit.

# MMVP Widget (Local Demo + Production Embed Bundle)

This repo gives you:
- A working **embedded widget** inside an "article" page (`index.html`)
- A **modal vertical player** with 3-slot recycling (prev/current/next)
- Swipe (mobile), wheel + keyboard (desktop), long-press clean mode
- Finite playlist + reg wall stub + end card
- Analytics events pushed to `window.dataLayer` (and logged to console)

## Run locally (Cursor-friendly)
1) Open this folder in Cursor
2) Install deps:
   ```bash
   npm install
   ```
3) Start dev server:
   ```bash
   npm run dev
   ```
4) Open the URL Vite prints (usually http://localhost:5173)

Click the teaser tile to open the player.

## Build the production embed bundle
```bash
npm run build
```

Outputs:
- Demo site: `dist/`
- Production widget: `dist-widget/embed.js`

### How a publisher would use the widget
Add this to an article page:

```html
<div class="mmvp" data-mmvp-context="auto" data-mmvp-regwall-after="4"></div>
<script async src="https://cdn.YOURDOMAIN.com/mmvp/v1/embed.js"></script>
```

Replace the demo payload in `src/widget/Widget.tsx` with a real fetch from your playlist API.

## Where to plug your real systems
- **Playlist API fetch**: `src/widget/Widget.tsx`
- **VAST/SIMID/Prebid/IMA**: replace `src/player/renderers/AdRenderer.tsx`
- **Google One Tap**: replace reg wall stub in `src/player/VerticalPlayer.tsx`

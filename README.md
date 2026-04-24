# Silent Reach

Content intelligence for Silent Story. Plan non-follower reach before you film, then pack the content the moment you upload.

Two modes:

- **Pre-Shoot Brief** — turn a rough concept into a hook, shot list, title options, thumbnail direction, and retention plan before you film.
- **Post-Upload Pack** — paste a YouTube URL, get IG / LinkedIn / Facebook captions, title A/B variants, hook rewrites, chapter markers, and shareable clip timestamps.

Both modes are tuned for Victoria BC real estate and renovation content.

## Stack

- Next.js 14 (App Router) + TypeScript + Tailwind CSS
- Anthropic Claude (Sonnet) for content generation
- YouTube Data API v3 for video metadata
- `youtube-transcript` npm for captions (falls back to manual paste when unavailable)
- localStorage for personal history (no database)

## Quick start (local)

```bash
npm install
cp .env.local.example .env.local
# Fill in ANTHROPIC_API_KEY and YOUTUBE_API_KEY
npm run dev
```

Open <http://localhost:3000>.

## API keys

- `ANTHROPIC_API_KEY` — <https://console.anthropic.com/settings/keys>
- `YOUTUBE_API_KEY` — Google Cloud Console → Enable *YouTube Data API v3* → Credentials → Create API key

## Deploy on Vercel

1. Push this repo to GitHub.
2. Import it at <https://vercel.com/new>.
3. In project settings → Environment Variables, add `ANTHROPIC_API_KEY` and `YOUTUBE_API_KEY`.
4. Click Deploy.

### Custom domain

In Vercel project → Settings → Domains, add your domain. Point your registrar's DNS to the values Vercel shows (A record `76.76.21.21` for apex, or CNAME to `cname.vercel-dns.com` for subdomains).

## Project layout

```
app/
  layout.tsx, page.tsx, globals.css
  pre-shoot/page.tsx
  post-upload/page.tsx
  history/page.tsx
  api/
    pre-shoot/route.ts
    post-upload/route.ts
components/
  Header.tsx, BriefResult.tsx, PackResult.tsx, CopyButton.tsx
lib/
  claude.ts, youtube.ts, prompts.ts, storage.ts, utils.ts
types/
  index.ts
public/
  logo.svg
```

## Notes

- **Single user, no auth.** History is stored in the browser's localStorage.
- **Model ID.** The app uses `claude-sonnet-4-5`. If Anthropic deprecates it, swap the `MODEL` const in `lib/claude.ts` for the current Sonnet model ID.
- **Transcript failures.** ~5–10% of YouTube videos don't expose a transcript. The app will ask you to paste one manually and retry.
- **Cost.** Anthropic API usage is the only recurring cost (~$5–15/month at normal personal use). Vercel and YouTube Data API are free at this scale.

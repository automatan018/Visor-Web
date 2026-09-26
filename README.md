# Visor Web

A companion website for the Visor Chrome extension. Sign in with Google, pick
a Doc or Slides file through Google's own file picker, and it shows who wrote
what — pulled from Google's official Drive API.

## Why "pick a file" instead of "paste a link" — and why that matters

This app uses the `drive.file` OAuth scope, not `drive.readonly`. That's a
deliberate trade, not a limitation that crept in:

- `drive.readonly` (and `drive`) are **Restricted** scopes. Using one for
  real public users requires Google's annual, paid CASA security assessment
  — realistically weeks of process and real money, every year, before anyone
  outside a short manual test-user list can sign in.
- `drive.file` is **non-sensitive**. It requires no verification at all and
  works for unlimited public users immediately — the trade is that the app
  never gets standing access to a user's whole Drive. It only ever sees a
  file the user explicitly hands over through Google's own Picker dialog
  (`components/GooglePicker.tsx`), one file at a time. There is no way to
  paste an arbitrary link and have it work — Google enforces the scope's
  narrower access at the API level, so an unpicked file just 404s.

If you later genuinely need arbitrary-link access for many users, that means
going through the restricted-scope process for real — there's no shortcut
that avoids it while keeping that capability.

## How this differs from the extension — read this first

The extension (`changelog.js`) reads Google Docs' **internal, undocumented**
`/revisions/load` endpoint, authenticated by your live browser session on
`docs.google.com`. That's how it gets a per-keystroke edit stream and can say
exactly who typed which character. A separate website has no access to that
session, and re-implementing that endpoint server-side would mean
impersonating Google's own web client outside any sanctioned API — that's not
what this does, and not something worth building even if it were technically
possible.

Instead, Visor Web uses Google's **public, documented** Drive API
[`revisions`](https://developers.google.com/drive/api/reference/rest/v3/revisions)
resource:

- It only sees the **saved snapshots** Drive retains for a file, not every
  keystroke. Google prunes automatic revisions after ~30 days or 100
  revisions (whichever comes first) unless one was explicitly "kept forever,"
  so old history may simply be gone — there's no way around that from any
  API.
- Between two snapshots, several people might have edited. This tool diffs
  the two snapshots' text and credits the *entire* change to whoever saved
  the later one — it can't split a between-snapshot gap between multiple
  editors the way a full op-stream can.
- Attribution is by revision, not by character. The UI is upfront about this:
  it reports revisions analyzed vs. skipped, and whether the history shown was
  sampled down from a longer one.

If someone needs the finer-grained, per-keystroke picture, that's what the
extension is for — it's reading data this app fundamentally cannot get to.

## Setup

### 1. Google Cloud project

1. Create (or reuse) a project at [console.cloud.google.com](https://console.cloud.google.com).
2. **APIs & Services → Library** → enable both the **Google Drive API** and
   the **Google Picker API**.
3. **APIs & Services → OAuth consent screen**:
   - User type: External (or Internal if you're on Google Workspace and only
     need this for your org).
   - Scopes: add `https://www.googleapis.com/auth/drive.file`. Because this
     is a non-sensitive scope, you can publish straight to **Production** —
     there's no Testing/test-users restriction to work around, and no
     verification wait for this scope specifically. (Google still does a
     quick automated check of your app's basic info before Production apps
     go live; that's unrelated to the restricted-scope process this setup
     avoids.)
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Application type: **Web application**.
   - Authorized redirect URIs:
     - `http://localhost:3000/api/auth/callback/google` (local dev)
     - `https://<your-deployed-domain>/api/auth/callback/google` (production)
   - Copy the generated Client ID and Client Secret.
5. **APIs & Services → Credentials → Create Credentials → API key**:
   - This is a separate credential from the OAuth client — it authenticates
     the Picker widget itself, not the user.
   - Click the new key → **Restrict key**: under API restrictions, select
     only **Google Picker API**. Under Application restrictions, add your
     site's domain(s) (and `localhost:3000` for dev, if the console accepts
     it — otherwise leave Application restrictions open in dev and lock it
     down before going to production).
   - Copy the key.

### 2. Environment variables

```bash
cp .env.example .env.local
```

Fill in:

```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
NEXTAUTH_SECRET=...       # generate with: openssl rand -base64 32
NEXTAUTH_URL=http://localhost:3000   # your real URL in production
NEXT_PUBLIC_GOOGLE_API_KEY=...       # the Picker API key from step 5 above
```

### 3. Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000, sign in with any Google account, and use the
"Select a Doc or Slides file" button to pick a file through the Google Picker.

### 4. Deploy

Any Node host works; Vercel is the path of least resistance for a Next.js app:

```bash
npx vercel
```

Set the same environment variables in the host's dashboard, and add the
production callback URL to the OAuth client's redirect URIs in Google Cloud
Console.

`app/api/analyze/route.ts` sets `maxDuration = 60` for hosts that respect it
(Vercel does on paid tiers; the Hobby tier caps functions at 10s, which may
not be enough for a document with many revisions — lower
`MAX_ANALYZED_REVISIONS` in that file if you hit timeouts).

## Privacy notes for your own listing

Unlike the extension, this app **does** use OAuth and **does** make a
server-side request to Google (the Drive API) on the user's behalf. If you
publish this, your privacy policy needs to say so plainly — it's a
meaningfully different privacy story than "no OAuth, no API, no server,"
which is what the extension currently claims about itself. Consider:

- Nothing is written to a database — every analysis is computed on request
  and discarded when the response is sent (confirm this stays true if you add
  storage later).
- The OAuth token is scoped to `drive.file`: the app can only ever act on a
  file the user explicitly picked through the Google Picker. It never calls
  `files.list` and never enumerates the user's Drive — technically, not just
  by policy.
- Access tokens live only in the encrypted NextAuth session cookie in the
  user's own browser, and are also handed to the Picker widget client-side
  (still the user's own browser) to authorize the pick itself.

## Project layout

```
src/
  app/
    page.tsx                     — sign-in + paste-link UI + results
    layout.tsx                   — shell, pulls in glass.css for the shared look
    glass.css                    — copied from the extension for visual consistency
    api/
      auth/[...nextauth]/route.ts — Google OAuth via NextAuth
      analyze/route.ts            — fetches + diffs revisions for one file
  lib/
    googleDrive.ts   — Drive API calls (metadata, revisions, export text)
    authorship.ts     — diffs consecutive revisions into per-author char counts
    auth.ts            — NextAuth config (drive.file scope, token refresh)
  components/
    GooglePicker.tsx  — the Google Picker button; how the drive.file grant happens
```

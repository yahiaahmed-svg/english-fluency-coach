# English Fluency Coach Pro

A PWA English-learning app with:
- English sentence + Arabic pronunciation + Arabic meaning
- Daily lessons
- Spaced-repetition smart review
- Browser TTS (US/UK)
- Cloud sign-in and cross-device sync with Supabase
- AI Coach: conversation, correction, CEFR upgrade, lesson generation
- Speaking recorder + transcription-based speech match
- Dashboard, XP, streak, favorites
- Offline shell via Service Worker

## Security architecture
The OpenAI API key is NEVER placed in the browser.
The public frontend talks to authenticated Supabase Edge Functions, and the functions read `OPENAI_API_KEY` from server-side secrets.

## Fastest one-time cloud setup

### Windows
Right-click PowerShell / Terminal in this folder and run:
`powershell -ExecutionPolicy Bypass -File .\SETUP_CLOUD_WINDOWS.ps1`

### macOS / Linux
Run:
`./SETUP_CLOUD_MAC_LINUX.sh`

The scripts link your Supabase project, apply the database schema, deploy both functions, and set the OpenAI secrets.

## Manual one-time cloud setup
1. Create a Supabase project.
2. Open SQL Editor and run `supabase/schema.sql`.
3. Deploy the two Edge Functions:
   - `ai-coach`
   - `speech-score`
4. Set function/project secrets:
   - `OPENAI_API_KEY`
   - `OPENAI_TEXT_MODEL=gpt-6-luna` (optional; this is the default in the code)
   - `OPENAI_TRANSCRIBE_MODEL=gpt-4o-mini-transcribe` (optional; default in code)
5. In Supabase Authentication URL settings, add your GitHub Pages URL as Site URL / Redirect URL.
6. Open the app → Settings → الحساب والسحابة → paste:
   - Supabase Project URL
   - Supabase Publishable Key
7. Sign in with your own email using the magic link.

## Important privacy note
Do not hardcode your personal email address in a public GitHub repository.
Use it only when signing in or, if desired, store owner/admin roles server-side.

## GitHub Pages
Upload the root files to your repository:
`index.html`, `styles.css`, `app.js`, `cloud.js`, `data.js`, icons, manifest, service-worker, `.nojekyll`.
Then Settings → Pages → Deploy from branch → `main` → `/(root)`.

## Current pronunciation score
The speech feature transcribes your audio and compares the recognized words with the target sentence.
It is a useful practice signal, but it is NOT a laboratory-grade accent/phoneme score.

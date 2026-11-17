# Agora Voice AI Workshop - V2 presentation

This is a static-first, Vercel-ready presentation website. The host and audience share one canonical HTML deck; a small browser bundle adds Agora Signaling, and Vercel API functions mint RTM tokens and store saved events in Vercel Blob.

## Local setup

The repository is bound to the existing Agora `Testing` project in `.agora/project.json`. Use Agora CLI to refresh the ignored local environment, then install and run:

```sh
agora project use Testing
agora project env write .env.local --project Testing --template standard
npm install
npm run dev
```

The host route requires the password `AgoraWorkshop2026` by default. `WORKSHOP_HOST_KEY` can override that committed development password in the deployment environment. The accepted password stays in the presenter’s browser tab and is never placed in the URL.

## Presenting

Participants open the root URL and choose **Join active**, or enter a six-digit event code. Join active derives the local calendar date, such as `2026-08-12`, and connects to the RTM message channel with that exact name. Code links load saved settings without connecting to RTM.

The presenter opens `/host`, enters the workshop password, and then connects as the trusted host for the same channel. Presenter controls remain covered until authentication succeeds.

If two workshops share a date or device dates disagree, override the channel in both URLs:

```text
Audience: /?join=active&channel=sf-rehearsal
Host:     /host?channel=sf-rehearsal
Notes:    /host-notes?channel=sf-rehearsal
```

For mobile presenter notes, open `/host-notes` on a phone and enter the same workshop password. The phone must use the same channel as `/host`. It receives the current slide’s notes and scripted desktop-demo steps through RTM without slide controls. Notes continue following the presenter while audience sync is paused. Returning to the phone page reconnects and requests the current slide; a Reconnect button is also available. Reloading the notes page requires the password again. Use the live channel for notes, not a saved event code.

Overrides are normalized to lowercase URL-safe names; spaces become hyphens. Names must start with a letter or number, contain only letters, numbers, `_`, and `-`, and be no longer than 48 characters. An invalid override is never allowed to silently fall back to the date channel.

- Arrow keys, Space, Page Up, and Page Down move through slides.
- `H` opens host controls from any slide.
- `N` opens the notes for the current slide.
- `F` toggles full screen.
- `T` toggles light and dark themes.
- `?` shows all shortcuts.
- The city bubble displays only the current city and switches when clicked.

The understated desktop-demo cue marks a scripted switch to the terminal, browser, editor, or app. Its full **Show / Say / Checkpoint / Return** script appears in presenter notes and the mobile companion. Edit these shared scripts in [`src/presenter-cues.js`](src/presenter-cues.js). See [`HOST-GUIDE.md`](HOST-GUIDE.md) for the rundown and rehearsal checks.

## Audience view

Participants use `/` to choose a workshop, or `/?join=active&channel=...` for a live workshop with a channel override. After choosing Join active, their browser resolves the channel, reuses a browser-scoped string UID from local storage, subscribes with messages and presence, and requests the current snapshot. The server validates the audience-only UID format and mints every reload or renewal token for that exact subject. Before the first trusted host snapshot arrives, a dedicated waiting screen explains that the session has not started without exposing signaling details. The deck appears automatically when the authenticated host connects. `/audience` remains as a compatibility alias.

- Host controls, presenter notes, timing cues, and their keyboard shortcuts are unavailable.
- Slides, links, copy/download actions, and visual content come from the same `index.html` used by the host.
- Every slide has a stable `data-slide-id`; URLs such as `#slide-install-cli` keep working if slides are reordered.
- While following, host-controlled navigation is locked but links, copy buttons, and downloads remain usable.
- **Following host** switches to independent browsing; **Return to live** applies the newest host snapshot.
- Late arrivals request the current snapshot, and host presence events provide an additional recovery path.
- After the first trusted host snapshot, the audience browser saves a safe local copy of the workshop choices. On a later visit, the join screen also offers **View presentation** for that device’s last workshop.

The presentation exposes a transport-neutral API at `window.workshopPresentation`. `src/signaling.js` publishes host snapshots from `workshop:statechange` and dispatches validated remote snapshots to the audience view. The demo has no SIP options.

Saved events and local audience copies retain the event date and times, Bitly join link, venue, template, code track, derived project tooling, model-provider selections, theme, and terminal environment. They exclude Wi-Fi passwords, operational credentials, and host keys. Live slide fragments are cleared while waiting or following the host. Saved-event URLs retain the code and slide fragment for reloads and independent navigation.

## Saved event codes

In host controls, open **Saved events**. Enter an event name and choose **New event code** to create a saved copy of the current settings. The server generates a random six-digit code, such as `482-193`, with collision retries. Share `/?code=482-193`. Attendees can also enter `482193` or `482-193` on the join screen; submitting redirects to the code URL.

Choose a previous code from the paginated list, or open it by code, to view and edit its settings. Opening a previous event disconnects live sharing first. **Use settings live** explicitly connects those settings to the current date/channel. Host URLs also retain the code, so a reload reopens that event after authentication without connecting to RTM.

After creating or opening an event, changes save automatically after 700 ms. **Save changes** retries a failed save. Slide navigation does not trigger writes. A stale version returns a conflict and requires reopening the event; unsaved local settings stay visible. Leaving with pending changes triggers the browser’s unsaved-changes prompt. **New event code** creates another record from the current settings; it does not reuse the old code.

`GET /api/events?code=482-193` loads the replay JSON without host authentication. A bare `GET /api/events` lists event codes for an authenticated host (with an optional `cursor`). `POST /api/events` creates an event; `PUT /api/events?code=482-193` overwrites that event. Host requests send the workshop password in `x-workshop-host-key`. Updates must include the ETag returned by the latest read or write.

Connect a **private Vercel Blob store** and provide its `BLOB_READ_WRITE_TOKEN` in Vercel and `.env.local` for local development. Each event is exactly `<code>.json` at the store root. No random filename suffix is added. Creates refuse overwrites; updates use `allowOverwrite` and `ifMatch`. Reads use `get(..., { useCache: false })`, and API responses use `Cache-Control: no-store`, so reopening an event reads its latest saved settings. See the [Vercel Blob SDK documentation](https://vercel.com/docs/vercel-blob/using-blob-sdk).

Code links are shareable workshop content, not passwords. Missing, invalid, or unavailable codes display an error and do not fall back to RTM. **Join active** explicitly removes the code and restores the live flow. Saved settings replay with the current deployed deck; they are not a frozen copy of historical slide HTML.

## Verification

```sh
npm run verify
agora project feature status rtm
```

The tests mock the Agora SDK boundary and cover local-date session validation, RTM login-before-subscribe, message and presence subscription, trusted-host filtering, late joins, login failure, token renewal, cleanup order, token subject identity, environment password overrides, and the committed fallback password.

The selected `Testing` project currently reports token enforcement as disabled in Agora Console. The app still uses server-generated tokens and never exposes the App Certificate, but token enforcement must be enabled on the project before treating a public deployment as authenticated.

Host choices stay in that browser until the host creates or opens a saved event. Replay-safe choices then also save to that event:

- Workshop date, doors time, workshop start time, and Bitly join link (under **Event details** in host controls; times use venue local time)
- Venue Wi-Fi name and session-only password for the projected opening slide
- San Francisco or New York
- Python, Next.js, or Go
- Track-derived tooling: Bun for Python, pnpm for TypeScript, or Make for Go
- Light, dark, or system theme

Python and Bun are the defaults.

## Required configuration before publishing

### Discord invite QR

The included `discord-qr.svg` is an obvious placeholder. Create the global live-events invite, copy `workshop-config.example.json` to a local configuration file, insert the real HTTPS invite, and generate the replacement:

```sh
python3 scripts/generate-discord-qr.py workshop-config.json discord-qr.svg
```

This requires the Python `reportlab` package. Scan the generated QR from a second device before publishing.

## Deployment

Import this directory as a new Vercel project or run the Vercel CLI from this directory. `vercel.json` supplies the static-site settings and basic response headers.

The attendee projects use different optional finish paths:

- Next.js: Vercel
- Python: Render
- Go: Render
- Any local track: Cloudflare Quick Tunnel for a short-lived preview

Local execution remains the required workshop finish line.

The provider links in the deck currently open the provider's deployment entry point. After each track passes rehearsal, replace them with repository-specific one-click deployment URLs for the verified workshop starter.

## Clean-machine rehearsal

Rehearse the selected code track, derived tooling, and venue network end to end. Python uses Bun, TypeScript uses pnpm, and Go uses Make.

1. Run `agora quickstart list` and confirm `python`, `nextjs`, and `go` remain current template IDs.
2. Run the selected quickstart from a clean machine.
3. For Go, verify whether the explicit environment-write step is still required.
4. Browse [Agora Recipes](https://recipes.agora.io/), use [Tool Calling](https://recipes.agora.io/recipes/tool-calling) as the worked example, and inspect it with `agora recipes list --type ai` and `agora recipes show tool-calling`. Participants may substitute another catalog slug.
5. Demonstrate `agora init recipe-demo --recipe tool-calling` from the workshop root. Tool Calling uses Python and Bun: inside `recipe-demo`, run `bun run setup` then `bun run dev`. Other recipes have their own runtime, prerequisites, and setup commands. Return to the workshop root afterward.
6. Run `npx skills add agoraio/skills` from the workshop root, choose project/workspace scope if prompted, and confirm the presenter's coding agent loads the Agora Skill.
7. Choose **New** (default) or **Update**, then replace only `[your use case]` in the short prompt. The coding assistant uses Agora Skills and the Agora CLI to find and adapt a suitable recipe from https://recipes.agora.io. Participants choose their own goal. The slide’s copy/download actions use the selected version; `PROMPT.md` contains both. These choices are local to each participant and do not change the host’s settings. Neither prompt appends implementation requirements.
8. Choose one conversation before building, then test each generated app against that goal. Inspect any tool result or saved output. If an action is simulated, confirm the app says so.
9. Test the selected durable deploy button and the Cloudflare tunnel against the generated app.
10. Run `agora project doctor --deep` before doors open.
11. Scan the Discord QR from iOS and Android.
12. Open `/host-notes` on a phone using the presenter’s channel and password. Confirm notes and demo scripts follow slide changes, including while audience sync is paused. Rehearse each switch to the desktop and return to the named slide.
13. Create a saved event code, reopen its link on another device, and confirm the settings load without a live host. Edit and save the event, then reload the attendee link to check the update.

The event schedule still has an unassigned 6:00–6:45 interval. Resolve it with the event team and reconcile demo durations before rehearsal; the current times in the deck and host guide are preserved.

## First-party command references

- [Voice Agent quickstart](https://docs.agora.io/en/ai/get-started/quickstart)
- [Agora CLI](https://github.com/AgoraIO/cli)
- [Agora Recipes catalog](https://recipes.agora.io/)
- [Recipe discovery with the CLI](https://github.com/AgoraIO/cli#recipes)
- [Python quickstart](https://github.com/AgoraIO-Conversational-AI/agent-quickstart-python)
- [Next.js quickstart](https://github.com/AgoraIO-Conversational-AI/agent-quickstart-nextjs)
- [Go quickstart](https://github.com/AgoraIO-Conversational-AI/agent-quickstart-go)
- [Integrate with Agora Skills](https://docs.agora.io/en/ai/get-started/skills-integrate)
- [Start and stop an agent](https://docs.agora.io/en/ai/build/start-stop-agent)
- [Managed mode](https://docs.agora.io/en/ai/build/custom-model-integration/managed-mode)
- [Web AI Noise Suppression](https://docs.agora.io/en/realtime-media/voice/build/enhance-the-audio-experience/ai-noise-suppression/web)
# Agents-Get-Started-Workshop

# Host guide

## Event timing

| Time | Segment | Required outcome |
| --- | --- | --- |
| 5:30 | Doors and setup | Wi-Fi connected, accounts verified, headphones ready |
| 5:45-5:50 | Welcome | Introduce the quickstart, recipes, and a custom Skills build |
| 5:50-6:00 | Agora foundation | Attendees understand SDRTN, Channels, configuration, start/stop, and webhooks |
| 6:45-7:17 | Agora CLI and agent structure | Untouched quickstart runs; attendees recognize the Agent SDK, definition, lifecycle, managed keys, and BYOK |
| 7:17-7:23 | Agora Recipes | Developers choose a recipe, inspect it with the CLI, and see recipe-based initialization |
| 7:23-7:45 | Agora Skills | Describe a use case in a short prompt; the coding assistant uses Skills and the CLI to find and adapt a recipe |
| 7:45-8:15 | Build clinic | Individualized CLI and Skills support; optional tunnel/deploy |
| 8:15-8:20 | Close | Discord badge, sample repository, community, next monthly workshop |
| 8:30-9:00 | Cleanup | Stop tunnels and demos, clear venue |

The current schedule leaves 6:00–6:45 unassigned. Confirm that interval before rehearsal. The desktop-demo durations are estimates, not a replacement schedule; the recipe demos alone total about eight minutes against the six-minute recipe slot above. Reconcile those timings before the event.

## Host configuration

Participants open the root workshop URL and choose **Join active** for the live session, or enter an event code for a saved workshop. The presenter opens `/host` and enters the default password `AgoraWorkshop2026`; presenter controls remain covered until authentication succeeds. Both views use the local date as the Agora RTM channel, for example `2026-08-12`.

For same-day conflicts or mismatched device dates, add the same override to both URLs: `/host?channel=sf-rehearsal` for the presenter and `/?join=active&channel=sf-rehearsal` for participants.

After choosing Join active and before the host connects, participants see a waiting screen confirming that they are in the right place. Once the first host snapshot arrives, the deck appears automatically. They can choose **Following host** to browse independently and **Return to live** to catch up. Links and copy/download actions remain available while slide navigation is host-controlled.

Press `H` from any slide and select:

- Venue Wi-Fi name and password for the projected opening slide
- Event city
- Python, Next.js, or Go
- Track-derived tooling: Bun for Python, pnpm for TypeScript, or Make for Go
- Presentation theme (cycle System, Light, and Dark with the icon button)

Press `N` for the current slide's speaker notes.

On a phone, open `/host-notes` and enter the same workshop password. Use the same channel as the presenter, for example `/host-notes?channel=sf-rehearsal`. This companion displays the current slide's notes and desktop-demo script over RTM; it does not control the slides. Notes continue following the presenter when audience sync is paused. Returning from another phone app reconnects to the current slide. Use Reconnect if needed.

## Slides and desktop demos

The small desktop-demo cue marks a planned switch away from the slides. Keep the full script on the phone or in the notes panel. Each script has four parts: **Show**, **Say**, **Checkpoint**, and **Return**. The shared scripts live in [`src/presenter-cues.js`](src/presenter-cues.js); rehearse from that source rather than keeping a separate script that can drift.

| Moment | Show | Purpose |
| --- | --- | --- |
| Opening example | A rehearsed Tool Calling conversation | Give attendees a result to recognize when they inspect its recipe later |
| After the Agora introduction | Console and project selection | Connect the platform explanation to each attendee's account |
| CLI installation | Installation docs, then terminal | Show where the command comes from; keep the slide's copyable command available |
| CLI setup and first run | Authorization, initialization, then a local conversation | Establish a working reference before explaining its code |
| Agent walkthrough | The generated agent file | Connect instructions, model configuration, and session lifecycle to the conversation |
| Recipes | Catalog, CLI discovery, then recipe initialization | Show how to find and inspect an example before adapting it |
| Agent-ready docs | Copy Page and the documentation index | Show how the coding assistant can receive relevant documentation |
| Skills and custom build | Skills installation, then a short use-case prompt | Let attendees apply the same tools to their own idea |
| Local test | The generated app and its actual results | Check the conversation attendees chose before building |

Before each switch, say what attendees should watch for. Complete the checkpoint, then return to the named slide. Leave the build sequence visible while participants work. The opening example should take about a minute; show its result and save the setup explanation for the recipe section.

Before doors open, prepare the demo app, relevant docs tabs, terminal, code editor, and coding assistant. Rehearse the exact conversation and a short fallback recording in case the live demo fails. Confirm the phone follows slide changes before starting.

## Saved events

1. Press `H`, enter an event name under **Saved events**, and click **New event code**. This saves the current workshop settings and generates a code such as `482-193`.
2. Copy the event link and share it with attendees. They can return after the workshop ends, with no host or live connection required.
3. Changes to the selected event save automatically. Wait for **Saved** before closing the tab. Use **Save changes** to retry an unsuccessful save.
4. To edit an earlier workshop, choose it under **Previous events** and click **Open event**, or enter its code and click **Open code**. This pauses live sharing. Click **Use settings live** only when you want the room to follow those settings.
5. To create another workshop, click **New event code** before renaming or editing the newly selected copy. The previous event keeps its code and saved settings.

A private Vercel Blob store must be connected before saving events. Wi-Fi credentials remain local to the presenter. SIP is not part of this demo. Saved links use the current deck with the selected event’s settings.

## Staffing

### San Francisco

- Hosts: Hermes and Mason
- Support: Bien, Yi, and possibly K2

### New York

- Host: Hermes
- Support: Bryce and Aleksey

During hands-on sections, assign separate CLI and Skills support owners. Questions are welcome throughout; stage instruction should continue while support resolves individual blockers.

## Hard boundaries

- Use individual attendee Agora projects.
- Use managed keys for hands-on work; demonstrate BYOK without revealing a secret.
- Keep the first CLI quickstart untouched.
- Use [Tool Calling](https://recipes.agora.io/recipes/tool-calling) as the worked CLI example (`agora recipes show tool-calling`, then `agora init recipe-demo --recipe tool-calling`). Developers may choose another recipe from the catalog and substitute its slug. In the Skills prompt, participants fill in only `[your use case]`; the coding assistant uses Agora Skills and the CLI to find and adapt a suitable recipe.
- `recipes list` and `recipes show` are read-only. `init --recipe` clones and configures a supported recipe; its runtime and setup commands come from the recipe, not the workshop language selection.
- Keep the recipe CLI demo in `recipe-demo/`. If you enter that folder, return to the workshop root before installing Skills. Running a third app is optional.
- Participants choose **New** (default) or **Update**, then customize only the short prompt’s use case. For an existing app, open the coding agent in that app’s workspace. Use a separate folder from the quickstart. Participants may include audience, language, or other context in their use-case description, but no other fields are required.
- Choose a rehearsed presenter use case and one conversation that demonstrates it. Participants choose their own goal and test. If an app simulates an action, make that clear in the app and during the demo.
- A presenter may demonstrate a separately hosted real MCP or custom-LLM integration.
- Local voice success is required. Tunnel and cloud deployments are optional.
- AI Noise Suppression, when requested, is a client audio integration. Keep headphones as the dependable room recommendation.

## Recovery

- Quickstart blocked: run `agora project doctor --deep`; keep the room moving while a code-support owner helps.
- Recipe blocked: confirm its slug, CLI initialization support, and runtime prerequisites. Use its README and source as the Skills reference even if the scaffold demo is skipped.
- Skills blocked: confirm the command ran in the intended workspace (`agora_agents_workshop` for a new app, or the existing app for an update), project/workspace scope was selected, and the coding-agent session was refreshed.
- Room too noisy: switch from simultaneous testing to two waves and require headphones.
- Tunnel blocked: skip it. Local voice success is already the finish line.
- Time slipping: protect the untouched CLI quickstart, code-structure walkthrough, and one working custom project.

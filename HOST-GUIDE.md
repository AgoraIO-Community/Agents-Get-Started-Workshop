# Host guide

## Event timing

| Time | Segment | Required outcome |
| --- | --- | --- |
| 5:30 | Doors and setup | Wi-Fi connected, accounts verified, headphones ready |
| 5:45-5:50 | Welcome | Introduce the quickstart, recipes, and a custom Skills build |
| 5:50-6:00 | Agora foundation | Attendees understand SDRTN, Channels, configuration, start/stop, and webhooks |
| 6:45-7:17 | Agora CLI and agent structure | Untouched quickstart runs; attendees recognize the Agent SDK, definition, lifecycle, managed keys, and BYOK |
| 7:17-7:23 | Agora Recipes | Developers choose a recipe, inspect it with the CLI, and see recipe-based initialization |
| 7:23-7:45 | Agora Skills | Describe a use case in a short prompt; the agent references Agora Recipes and builds a custom app |
| 7:45-8:15 | Build clinic | Individualized CLI and Skills support; optional tunnel/deploy |
| 8:15-8:20 | Close | Discord badge, sample repository, community, next monthly workshop |
| 8:30-9:00 | Cleanup | Stop tunnels and demos, clear venue |

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
- Developers choose their own recipe from [Agora Recipes](https://recipes.agora.io/). Replace `RECIPE_SLUG` in CLI commands with its catalog slug. In the Skills prompt, participants fill in only `[your use case]`; the agent can find relevant recipes itself.
- `recipes list` and `recipes show` are read-only. `init --recipe` clones and configures a supported recipe; its runtime and setup commands come from the recipe, not the workshop language selection.
- Keep the recipe CLI demo in `recipe-demo/`. If you enter that folder, return to the workshop root before installing Skills. Running a third app is optional.
- Participants choose **New app / demo** (default) or **Existing app**, then customize only the short prompt’s use case. For an existing app, open the coding agent in that app’s workspace. `website-sdr` is the presenter’s example, not a required use case. Use a separate folder from the quickstart. Participants may include audience, language, or other context in their use-case description, but no other fields are required.
- For the presenter’s SDR example, request simulated lead submission in the context; it does not persist or transmit lead data. Participants define success for their own ideas.
- A presenter may demonstrate a separately hosted real MCP or custom-LLM integration.
- Local voice success is required. Tunnel and cloud deployments are optional.
- AI Noise Suppression, when requested, is a client audio integration. Keep headphones as the dependable room recommendation.

## Recovery

- Quickstart blocked: run `agora project doctor --deep`; keep the room moving while a code-support owner helps.
- Recipe blocked: confirm its slug, CLI initialization support, and runtime prerequisites. Use its README and source as the Skills reference even if the scaffold demo is skipped.
- Skills blocked: confirm the command ran at `agora_agents_workshop`, project/workspace scope was selected, and the coding-agent session was refreshed.
- Room too noisy: switch from simultaneous testing to two waves and require headphones.
- Tunnel blocked: skip it. Local voice success is already the finish line.
- Time slipping: protect the untouched CLI quickstart, code-structure walkthrough, and one working custom project.

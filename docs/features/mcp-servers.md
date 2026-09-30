# MCP Servers

The repo ships project-scoped [MCP](https://modelcontextprotocol.io) servers in **`.mcp.json`** (repo root). MCP clients such as Claude Code pick this file up automatically and ask for a one-time approval per server the first time you open a session in the repo.

They complement each other during development: **chrome-devtools** looks at the app from the outside (a real Chrome rendering the page) and is the default for a visual check or a performance pass, **firefox-devtools** does the same on Gecko when an engine difference is in question, **Astro Docs** answers framework questions from the official documentation.

## `chrome-devtools`

[chrome-devtools-mcp](https://github.com/ChromeDevTools/chrome-devtools-mcp) lets the agent drive and inspect a live Chrome instance through DevTools. It runs via `npx`, so there is nothing to install beforehand. Typical uses in this repo:

- **Performance**: record traces with lab LCP/CLS/INP plus DevTools insights (LCP breakdown, layout shift culprits, render-blocking requests), run Lighthouse audits, and apply CPU/network throttling. Useful for checking scroll-driven sections and page transitions under load.
- **Animations**: record screencasts (video) of transitions and scroll animations, then review them frame by frame; query `document.getAnimations()` or computed styles mid-animation via script evaluation.
- **Rendering**: screenshots (full page or per element) across viewport sizes, DOM/accessibility snapshots, console messages with source-mapped stack traces, and network request inspection.

### Configured flags

The entry in `.mcp.json` sets:

- `--isolated`: a temporary Chrome profile per launch, cleaned up on close. Keeps performance numbers reproducible (no warm cache or service workers) and keeps agent browsing out of a persistent profile.
- `--viewport=1920x1080`: consistent desktop baseline for screenshots and layout checks.
- `--experimentalScreencast`: enables video recording of the page. Requires **ffmpeg** on `PATH` (`brew install ffmpeg`); without it only the two screencast tools fail, everything else works.
- `--screenshotFormat=jpeg` and `--screenshotMaxWidth=1440`: screenshots enter the agent's context window, so they are compressed and downscaled to stay cheap. Remove the max-width flag if you need pixel-exact captures.
- `--no-usage-statistics`: opts out of the tool's telemetry.

### Requirements and notes

- Node.js LTS and a current stable Chrome; the server launches Chrome itself on first tool use.
- The browser instance is fully exposed to the MCP client: it can inspect and modify anything in that Chrome. The isolated profile keeps this away from personal browsing data; avoid logging into sensitive accounts inside it.
- Performance tools send traced URLs to Google's CrUX API to fetch real-user field data alongside lab results (only public URLs return data; localhost has none). Add `--no-performance-crux` to disable.

## `firefox-devtools`

[firefox-devtools-mcp](https://github.com/mozilla/firefox-devtools-mcp) is the same idea on the other engine: it drives a live Firefox over WebDriver BiDi (Selenium plus geckodriver, both managed for you), also via `npx`. Chrome's device emulation only ever renders Blink, so a layout, scroll, or animation difference that belongs to Gecko stays invisible until the page loads in Firefox. Typical uses in this repo:

- **Cross-engine rendering**: reproduce a bug reported in Firefox, and shoot the same section in both browsers before calling a fix done.
- **Debugging**: DOM/accessibility snapshots, console messages, network requests, script evaluation, and logpoints on a running script (Firefox 153+).
- **Profiling**: the Gecko profiler (`profiler_start` / `profiler_stop`, which writes a profile file). There is no Lighthouse or trace-insight equivalent here, so lab performance numbers stay on Chrome.

### Configured flags

The entry in `.mcp.json` sets:

- `--viewport 1920x1080`: the same desktop baseline as Chrome, so captures from the two line up.
- `--tool-preset developer`: the `basic` preset (pages, snapshots, input, screenshots, downloads, script, screencast) plus network, console, debugging, and the profiler. Presets stack `slim < basic < developer < mozilla < all`; `mozilla` and above expose privileged browser internals, which this repo has no use for.
- `--start-url about:blank`: Firefox opens on a blank page rather than a site. This is also the tool's default, spelled out so the launch page is never a surprise.

No profile flag is set, so geckodriver hands each launch a throwaway profile: the equivalent of Chrome's `--isolated`.

### Requirements and notes

- Node.js 20.19+ and a Firefox 100+ install, auto-detected (pass `--firefox-path` if it lives somewhere unusual). Screencast recording needs Firefox 154+ and writes a video file straight to disk, so it wants no ffmpeg.
- Firefox launches with a visible window: `--headless` is not set. Add it (or `FIREFOX_HEADLESS=true`) for an unattended run.
- Screenshots come back inline at full size; there is no format or max-width flag to shrink them. For a bulky screenshot, snapshot, console dump, or network dump, pass `saveTo` and read the file instead, which keeps the context window small. Paths resolve against the working directory, or against `~/.firefox-devtools-mcp` when absolute.
- Same exposure as Chrome: the agent can reach whatever that browser can. The throwaway profile keeps it away from personal browsing; do not sign into anything sensitive inside it.

## `Astro Docs`

The official Astro documentation MCP server (`https://mcp.docs.astro.build/mcp`, an HTTP server, no local process). It gives the agent searchable access to current Astro docs, so answers about routing, integrations, `astro:env`, view transitions, and adapter behavior match the framework rather than stale training data.

## Example prompts

- "Record a screencast of navigating from the home page to an article on localhost:4321 and check the page transition"
- "Trace localhost:4321 with 4x CPU throttling and report what causes layout shifts"
- "Screenshot the hero section at 375, 768, and 1920 wide and compare"
- "Open localhost:4321 in Firefox and screenshot the hero, then compare it with the Chrome capture"
- "Check the Astro docs for how injectRoute registers on-demand routes"

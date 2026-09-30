---
name: dev-server
description: How to reach the running site when a change has to be seen. Always reuse the dev server that is already running (4321 by default) and point a browser MCP at it (Chrome by default, Firefox when the engine itself is in question); only start your own, on another port, when none is running, and stop only what you started. Use before any local preview, screenshot, DevTools session, or visual check.
---

# Local dev server and headless preview

Verifying a visual change means loading the real site. The server is shared with whoever else is
working in the repo, so finding one beats starting one.

## Core Rules

- Check for a running server before starting anything: `npx astro dev status`, or `curl -s -o /dev/null -w '%{http_code}' http://localhost:4321/`.
- If one is running, use it. Never stop, restart, or reconfigure it: 4321 belongs to whoever is working in the repo, and killing it takes their session with it.
- Only when none is running may you start your own, on another port (`npm run dev -- --port 8080`). Stop only that one, by its task id or its port, when you are done.
- `astro dev` daemonises. The command exits after printing the URL and pid, the server keeps running, and `astro dev status` reports the one instance it tracks for the project.
- Chrome is the default browser for a visual check. Reach for the Firefox MCP when the engine itself is the question: a layout, scroll, or animation difference that only shows up in Gecko, or a bug reported there. Both drive the same dev server, so switching browser is never a reason to start a second one.
- The dev server never runs the Basic Auth gate (`IS_DEV` in `src/features/auth/gates.ts`), so localhost needs no credentials. A 401 from `astro dev` means that bypass broke, not that you are missing a password.
- A protected deployment is a different problem: do not reach it with `http://user:pass@host/`. Chrome drops URL credentials from subresource requests, so the HTML arrives, every module script 401s, and you get a page that paints its server-rendered shell while no custom element upgrades. It reads as broken code. Inject an `Authorization` header instead (a small local forwarding proxy), and do not try to slip past the gate with the Sanity perspective cookie: on its own it no longer skips Basic Auth or renders drafts; only a signed `__draft_session` from a real Presentation handshake does, and that shows drafts plus the draft overlay.

## Trigger Conditions

Apply before running or previewing the app: screenshots, chrome-devtools or firefox-devtools MCP
sessions, performance traces, and any "does this actually look right" check.

## Execution Checklist

1. Look for a running server (`npx astro dev status`, then a `curl` to confirm it answers).
2. Reuse it if it is there. Otherwise start one on a free port and remember that it is yours to clean up.
3. Drive the page in the browser (Chrome unless the check is engine-specific), then confirm the client actually booted before trusting a screenshot: `document.readyState === 'complete'`, and a custom element the page uses is defined (`customElements.get('lenis-scroll')`, the scroll shell every page renders). A page that renders but never upgrades is the signature of scripts failing to load.
4. Stop only the processes you started.

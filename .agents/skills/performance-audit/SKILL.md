---
name: performance-audit
description: Use when running or interpreting Lighthouse / Core Web Vitals audits, chasing LCP/TBT/CLS regressions, or executing a performance pass on a page or the whole site. Battle-tested playbook merged from real Lighthouse passes on production sites; covers measurement discipline, the known fix families, pitfalls that look like fixes, and browser verification. Do NOT use as the primary skill for deferring an element's JS (lazy-hydration) or motion craft (design-engineering).
---

# Performance audit (Lighthouse playbook)

Merged from full Lighthouse passes on several production Sanity-backed sites. Every finding was measured on a production build and fixed without changing visual output. Where numbers are quoted, they are real measurements from one of those passes, kept as calibration for what a fix family is worth.

This skill owns the audit process itself: how to measure, which fix family a symptom belongs to, which "fixes" are traps, and how to verify nothing visible changed. Deferring a component's JavaScript is `lazy-hydration`; animation craft is `design-engineering`.

**Read the references as calibration, not as repo conventions.** The passes behind them ran on React sites, so their code samples are React and their config pointers are not this repo's. The measurement discipline, the fix families, and the pitfalls all transfer; the snippets do not. Where a reference names a file or API this repo does not have, find the local equivalent (`astro.config.mjs`, a custom element, `lazyCustomElement`) instead of transcribing it.

## Core Rules

- **Audit the production build, never dev.** `npm run build && npm run start`. Kill stale servers by port, prove the server serves your build, run 3 times and take the median. See `references/measurement.md`.
- **Zero console errors first.** Hydration mismatches (React #418/#423) and failed requests inflate every other number and cap Best Practices. Nothing else is trustworthy until `errors-in-console` is clean.
- **Observed vs simulated LCP decides the fix family.** Observed LCP far after observed FCP means something really paints late (paint-timing family, `references/lcp.md`). Observed at first paint but simulated high means you are fighting total JS bytes (payload family, `references/payload.md`) and possibly a lantern floor you cannot cross.
- **Nothing invisible may be paid for.** Pre-reveal text must still paint (`opacity: 0.001` + `inert`, or paint under an opaque overlay). Collapsed/hidden DOM must not SSR at full fidelity. Below-fold media runtimes mount near-viewport. Dialog data loads on open. Decorative singletons mount only when their slot is visible.
- **"Deferred" is not "free".** `requestIdleCallback` and idle-warmed chunks still execute inside the load window and land in TBT. Warm on user intent (first `pointermove`/`keydown`), not on idle.
- **Weight effort by score math.** TBT 30% + LCP 25% + CLS 25% is 80% of the performance score; FCP and Speed Index are 10% each. Insight audits are diagnostics, not score inputs.
- **Verify choreography in a real browser before calling it done.** Lighthouse cannot see a reveal that silently degraded to a block fade. See `references/verification.md`.
- **Know the ceilings.** Framework floor, always-animating WebGL, autoplaying video walls, and lantern's localhost artifacts put hard caps on some pages. Document the cap and stop; do not chase it with micro-optimizations. See `references/pitfalls.md`.

## Trigger Conditions

Apply when: running a Lighthouse/PSI pass, investigating a Core Web Vitals regression, reviewing a PR whose risk is perf (new media runtime, new reveal animation, new provider, new third-party script), or porting a known perf fix into this repo. Not for every feature change.

## Execution Checklist

1. Build production, start a clean server, **prove** the port serves your build (curl for a string you just changed). Kill stale servers by port, not by process name.
2. Baseline every template (home, list, detail, special/legal pages), mobile and desktop, saved as JSON. 3 runs, medians. Issues differ per template.
3. Get `errors-in-console` to zero before trusting anything else (hydration mismatches, failed analytics beacons).
4. Compare observed vs simulated LCP per page and pick the fix family (`references/lcp.md` vs `references/payload.md`). Check the filmstrip when a paint is late and no metric explains it.
5. Hunt payload: weigh the HTML per section (hidden SSR DOM), measure document size per route (RSC-serialized props), fingerprint every chunk over ~50KB via source maps, trace transitive client imports of validators/SDKs/env.
6. Gate heavy media and decorative scenes on near-viewport or slot visibility; warm prefetches on intent; lazy-load closed-overlay internals; check stray high-priority preloads.
7. Grep for prerender-suspending hooks (`useSearchParams`) and check what their Suspense boundary blanks out of the static HTML.
8. List everything that enters the viewport after load (toasts, banners, chat bubbles): each is an LCP candidate for pages with small content; gate on engagement.
9. Scope analytics to production domains; `preconnect` media/API origins and `prefetchDNS` analytics from the server layout.
10. Read a11y failures item by item; several have structural causes (sticky covered elements, aria patterns that must branch on content). See `references/verification.md`.
11. Re-run medians after the last change, verify animations in a real browser with mid-flight probes, and treat PSI against the deployed URL as the final acceptance test.

## Scope Guidance

- **astro** / **lazy-hydration**: own bundle hygiene, hydration boundaries, and loading patterns as coding patterns. This skill tells you _which_ of those to reach for from audit evidence.
- **design-engineering** / **gsap-performance**: own the reveal/motion implementations this skill constrains (GSAP, Lenis, split-text systems). Perf fixes to animations must keep the choreography identical.
- Use native `IntersectionObserver` (or the existing custom-element patterns) when adding intersection/intent listeners for the gating patterns here.
- **docs-maintenance**: when a pass changes behavior or env expectations, update the docs in the same change.

## Non-Goals

- Chasing simulated-only localhost scores past a documented lantern floor.
- "Fixing" design decisions mechanically (target sizes, decorative contrast, LQIP-vs-sharp posters): surface them as options needing design sign-off.
- Restating the deferral mechanics that `lazy-hydration` owns.

## Done Criteria

- Every shipped fix maps to a measured symptom in a saved report, and the re-run median moved (or the ceiling is documented instead).
- Zero console errors on every audited template.
- Choreography verified visually identical in a real browser, not inferred from code.
- Visual/design tradeoffs left unfixed are documented with the option and its cost.

## Reference Files

- `references/measurement.md`: methodology, stale-server traps, simulate vs devtools throttling, lantern math, reading the LHR JSON, byte attribution via source maps, style-recalc tracing, layout-shift observer.
- `references/lcp.md`: the paint-timing fix families: reveal-animated text, intro overlays, suspending hooks blanking prerender, hydration mismatches, late-appearing UI stealing LCP, image/preload discipline, text-splitting cost.
- `references/payload.md`: the byte/mounting fix families: hidden SSR DOM, RSC-serialized props, per-media-type runtime splitting, near-viewport mounting, visibility-gated singletons, intent warming, env/zod in client bundles, resource hints, analytics scoping.
- `references/pitfalls.md`: fixes that break things (viewport-gated splits, removed dynamic() skeletons, CORS-blind preloads), red herrings (core-js, chunk-marker greps), and hard ceilings (framework floor, WebGL, video walls).
- `references/verification.md`: proving "visually identical" with mid-flight probes and build bisection, plus the a11y companion fixes every perf pass trips over.

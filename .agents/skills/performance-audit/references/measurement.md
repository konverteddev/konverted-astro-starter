# Measurement

_War stories and code in this file come from Lighthouse passes on React sites. The measurement discipline, fix families, and pitfalls transfer; the React snippets and their config pointers do not. Find this repo's equivalent (a custom element, `lazyCustomElement`, `astro.config.mjs`) instead of transcribing a snippet._

Bad measurement produced every wrong conclusion across the Lighthouse passes this playbook is distilled from. Do this before touching code.

## Production build, clean server, proven contents

- **Dev-mode numbers are meaningless.** Always `npm run build && npm run start` (or `PORT=3005 npm run start`), then audit `localhost`.
- **Kill stale servers by port, not name.** `pkill -f "next start"` kills the npm wrapper but not the actual `next-server` process. The survivor keeps serving old HTML from in-memory caches and 500s on new chunk names, silently poisoning every score (one pass saw a11y drop to 69 from this; another chased plausible-looking garbage numbers for an hour). Use:

  ```sh
  kill $(lsof -tnP -iTCP:3000 -sTCP:LISTEN)
  ```

- **Prove the server has your build.** Another project's dev server can grab the port between restarts. Before trusting any number, curl the page and grep for a string you just changed.
- **Never run audits concurrently** or alongside builds. Parallel heavy processes skew the lantern simulation by 5 to 10 points.
- **Run 3 times, take the median.** Identical runs swing simulated LCP by more than 1s and TBT by 100 to 400ms on a loaded machine. Never conclude anything from a single run; a flaky CLS can randomly ding one run (see the sticky-footer pitfall).

## Commands

```sh
npx lighthouse http://localhost:3000/ --output=json --output-path=./report.json \
  --chrome-flags="--headless=new" --quiet
# desktop pass:
npx lighthouse http://localhost:3000/ --preset=desktop ...
# real throttling instead of simulation:
npx lighthouse http://localhost:3000/ --throttling-method=devtools ...
```

Quick JSON summary:

```sh
node -e "
const r=require('./report.json');
console.log(Object.entries(r.categories).map(([k,v])=>k+'='+Math.round(v.score*100)).join(' '));
for (const id of ['largest-contentful-paint','total-blocking-time','cumulative-layout-shift','speed-index']) console.log(id, r.audits[id].displayValue);
for (const ref of r.categories.accessibility.auditRefs) { const a=r.audits[ref.id]; if (a.score!==null && a.score<1) console.log('a11y fail:', a.id); }
"
```

## Audit every template

Home, list page, detail page, and any special page (legal, labs, dashboards). Issues differ per template: in one pass the legal page surfaced an a11y bug nothing else did; in another the legal page had 940ms TBT with almost no JS of its own; in a third, half the routes shared an LCP problem the homepage did not have.

## Simulate vs devtools throttling (and PSI)

- `--throttling-method=simulate` (the default, and what PSI uses): Lighthouse observes an unthrottled load, then replays the request graph through a network/CPU model ("lantern"). On localhost this has a nasty artifact: every script finishes in milliseconds, so everything lands "before" the observed LCP and gets counted in the simulated LCP dependency graph. Result: a hard LCP floor (~3.2s in one measured case) that no real optimization can cross, uniform across pages.
- `--throttling-method=devtools`: actually throttles connection and CPU. Far closer to real behavior on localhost (one measured page: 71 simulated vs 95 devtools).
- `next start` serves HTTP/1.1; the connection limit inflates lantern's request queueing and the `modern-http` insight always complains locally. Production (HTTP/2 + CDN) is strictly better, so local simulated scores are a lower bound.
- **Verdict:** localhost simulate for finding regressions, devtools for realistic local scores, PSI against the deployed URL as the acceptance test.

## Understanding lantern for text LCP

For a text LCP, lantern blends an optimistic estimate (render-blocking CSS + fonts, close to FCP) with a pessimistic one that includes **every script already in flight when the paint happened**. Async scripts start before first paint, so total initial JS dominates the pessimistic term; chunk-count and hash-layout changes between builds move it a few hundred ms, machine load moves it more.

Consequence: once observed LCP is at first paint, the ONLY way to move simulated LCP is to cut total initial JS bytes and execution. Do the math before micro-optimizing: framework floor (~140KB gz) plus an animation library plus app code can cap a mobile score in the 60s-80s regardless of real-world performance being excellent (one measured site: observed LCP ~100-300ms, simulated ~4s+). Document the cap; do not chase it.

## Reading the LHR JSON

The audits that located every real problem:

- `audits.metrics.details.items[0]`: both simulated and **observed** metrics. `observedLargestContentfulPaint` vs `largestContentfulPaint` is the fork in the road (see `lcp.md`).
- `errors-in-console`: hydration errors hide here as minified React errors (#418/#423).
- `lcp-breakdown-insight` + the LCP element node: which element is LCP, and load delay vs render delay. "Element render delay" dominating on animated text is the reveal-animation problem.
- `long-tasks`, `bootup-time`, `mainthread-work-breakdown`: what runs, from which chunk, in how many tasks. "Parse HTML & CSS" dominating on a tiny document points at DOM-mutating text splitting.
- `network-requests`: per-request timing, priority, transfer size. Sort scripts by `transferSize`; this also proves the "everything finishes before LCP" lantern artifact.
- `unused-javascript`: a chunk with high unused % is a lead, not a verdict; attribute it (below).
- `screenshot-thumbnails`: decode the base64 filmstrip and look at it. One glance can show the whole page painting a frame after the shell, which no metric explains as clearly.

Score weights (performance): TBT 30%, LCP 25%, CLS 25%, FCP 10%, SI 10%. `*-insight` audits are diagnostics only.

## Byte attribution (chunk names are mangled and greps lie)

- **Marker greps lie.** A chunk containing a component's name may only hold the lazy import reference, not the library. And Turbopack merges modules from unrelated lazy groups into shared commons chunks, so one route can download another section's data. `next/dynamic` does not guarantee exclusion from commons chunks.
- **Source maps tell the truth.** Turn them on temporarily (`vite: { build: { sourcemap: true } }` in `astro.config.mjs`; the Next edition uses `productionBrowserSourceMaps`), rebuild, then either read Lighthouse's `script-treemap-data` for per-package bytes, or resolve each chunk's `//# sourceMappingURL=<hash>.map` tail comment (Turbopack map hashes differ from the chunk filename) and sum `sourcesContent` lengths per `node_modules/<pkg>`, normalized to the chunk's byte size. One pass this way instantly revealed: next runtime 525KB (floor), a motion library 188KB, a decorative mock's 102KB data leaking into every page via commons chunks, zod 30KB, tailwind-merge 27KB.
- Grep-for-markers is still fine as a cheap first fingerprint for big libraries ("ClearMaskPass" identifies postprocessing, shader keywords identify three.js); confirm with source maps before acting.

## Weigh the HTML per section

To find hidden SSR DOM (see `payload.md`), weigh the served HTML between section markers:

```sh
node -e "
const html=require('fs').readFileSync('./page.html','utf8');
const marks=[...html.matchAll(/data-page-builder-section=\"([a-zA-Z]+)\"/g)].map(m=>({i:m.index,name:m[1]}));
const end=html.indexOf('</main>');
for(let k=0;k<marks.length;k++){const e=k+1<marks.length?marks[k+1].i:end;
console.log(((e-marks[k].i)/1000).toFixed(0)+'KB', marks[k].name);}"
```

Also compare whole documents across routes (`curl <page> | wc -c`); one route 5x heavier than its siblings usually means an RSC-serialized prop.

## Tracing style recalc (TBT with no obvious JS)

Lighthouse says "Style & Layout: 636ms" but not why. Record a DevTools performance trace, filter `UpdateLayoutTree` events, and read `args.beginData.stackTrace`. One pass this way pinpointed a split-text library forcing a 55-125ms synchronous recalc per animated-text instance, all inside the hydration commit.

## Catching invisible CLS

When Lighthouse reports CLS but nothing visibly jumps, inject before navigation:

```js
new PerformanceObserver((l) => {
  for (const e of l.getEntries())
    if (!e.hadRecentInput)
      console.log(
        e.value,
        e.sources.map((s) => [s.node, s.previousRect, s.currentRect]),
      )
}).observe({ type: 'layout-shift', buffered: true })
```

The `previousRect -> currentRect` pairs identify the shifting element and mechanism (a `0x0` previousRect means the element appeared late).

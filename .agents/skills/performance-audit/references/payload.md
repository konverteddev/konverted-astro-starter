# Payload, bundles, and mounting

_War stories and code in this file come from Lighthouse passes on React sites. The measurement discipline, fix families, and pitfalls transfer; the React snippets and their config pointers do not. Find this repo's equivalent (a custom element, `lazyCustomElement`, `astro.config.mjs`) instead of transcribing a snippet._

Use this file when the problem is bytes or execution: heavy HTML, heavy chunks, high TBT, or a high **simulated** LCP while observed LCP is already at first paint (see `measurement.md` on lantern: simulated text LCP tracks total initial JS).

The unifying rule: **the only load-time cost a page may pay is for what it actually displays in the current viewport and breakpoint.** Everything else mounts near-viewport, on visibility, on intent, or on open.

## Hidden SSR DOM: render collapsed content lazily

**Symptom:** a decorative mock server-rendered ~280 file-tree rows, each with a multi-element SVG icon, inside collapsed folders (`grid-template-rows: 0fr`, invisible). 308KB of an 887KB homepage HTML, plus hundreds of nodes to hydrate, plus ~1s of HTML parse on a throttled phone.

**Fix:** render a collapsed container's children only after it has been opened once, latched so the collapse animation still has content to shrink:

```tsx
const [everOpened, setEverOpened] = React.useState(open)
if (open && !everOpened) setEverOpened(true) // render-phase state adjust, React-sanctioned
// in JSX: {everOpened || open ? children : null}
```

Expand still animates because the `0fr -> 1fr` change and the children mounting land in the same commit; collapse works because children stay mounted after first open.

**Sweep rule:** weigh the HTML per section (snippet in `measurement.md`). Anything invisible at rest (collapsed accordions with huge bodies, hidden tabs, off-screen carousel clones, hidden tree views) is a candidate. If it never paints before a user interaction, it does not belong in the SSR payload at full fidelity.

## RSC-serialized props: data for a closed dialog in every page

**Symptom:** page HTML 550-780KB; the RSC payload was 512KB of a 549KB document.

**Cause:** a server component fetched the full search dataset (full text of every document) and passed it as a prop to a client lightbox. RSC serializes client-component props into the HTML, and a twice-rendered header (desktop + mobile) inlined the dataset **twice per page**.

**Fix:** move the dataset behind a route handler (same query, same cache tags) and fetch it in the client component when the dialog first opens. The fetch races the user's first keystroke debounce and wins; recompute results when data arrives so a query typed before the payload lands still resolves. Measured result: one route went from 549KB to 72KB.

**Sweep rule:** every prop crossing the RSC-to-client boundary ships in the HTML and parses during hydration. Audit the biggest client components' props; anything needed only after an interaction (dialogs, autocomplete indexes, pickers) belongs behind an on-demand fetch or dynamic import. Quick check: `curl page | wc -c` across routes, grep the HTML for your largest dataset's field names.

## Heavy media runtimes: split per media type

**Symptom:** a shared media component branches on type (image, video player, Rive, Lottie); one branch statically imported its runtime, so ~50KB gz (plus a WASM loader) shipped on every page of a site with zero content of that type, folded into a commons chunk.

**Fix:** keep the layout wrapper (sizing, aspect ratio, viewport pausing) in the always-loaded module; move everything touching the runtime into its own module behind `next/dynamic`:

```tsx
const RiveCanvas = dynamic(() => import('./rive-canvas').then((m) => m.RiveCanvas), { ssr: false })
```

Hooks like `useRive` cannot be called conditionally, so the split point must be a component boundary, not an `if`.

**Sweep rule:** list what the page actually fetches (`network-requests`, `resourceType === 'Script'`, sort by `transferSize`), fingerprint suspicious chunks (`canvas_advanced.wasm`, `mux-player`, `dotlottie`, shader strings). Any player/renderer most pages never use must be behind a dynamic import in its own module. Runtime WASM fetched from the vendor's default CDN (e.g. unpkg) is acceptable as long as the runtime module is dynamically imported and mount-gated near-viewport, since the fetch then stays off the critical path; self-hosting the `.wasm` (postinstall copy to `public/` + the runtime's `setWasmUrl` equivalent) is optional hardening for CDN reliability, not a default requirement.

## Near-viewport mounting: gate the mount, not just playback

**Symptom:** 3.7MB page weight, TBT 1,330ms. Playback was viewport-gated but _loading_ was not. `next/dynamic` alone defers nothing meaningful: the component mounts at hydration, so the chunk plus everything it fetches loads immediately. Measured offenders in one pass: a 3D model viewer bundling three.js (~1MB raw, 1.8s CPU) for a bottom-of-page model, Rive WASM + ~1.9MB of `.riv` files, and a Lottie runtime, all at hydration.

**Fix:** a shared `useNearViewport` hook: an IntersectionObserver with a generous `rootMargin` (default 100%, one viewport ahead) that latches once true. Players render their placeholder until `isNear`, then mount the real thing; assets load about a viewport before the user arrives. Merge refs with `useMergedRef` when the element already has one.

**Sweep rule:** the question is never "does it play lazily" but "what does the network tab show at t=0 on a page where this content is below the fold".

## Visibility-gated singletons

**Symptom:** a site-wide provider mounted a WebGL background unconditionally: 231KB gz + 106KB gz (three.js + postprocessing), 1-1.6s of evaluation, on every route including ones where the background's slot did not exist or was `display: none`. It was already behind `next/dynamic` + `requestIdleCallback`, and that did not help: **"deferred to idle" still executes inside the trace and the TBT window**.

**Fix:** gate the mount on the slot being visible at least once (nonzero rect), latch it for the session so client-side navigation never remounts:

```tsx
const [everActive, setEverActive] = React.useState(false)
React.useEffect(() => {
  if (active) setEverActive(true)
}, [active])
// render: {everActive && <Scene active={active} />}
```

## Warm on intent, not idle

Idle-warming a heavy chunk (`requestIdleCallback`) optimizes the second interaction at the expense of the first paint: the parse/eval lands in TBT. Warm on the first sign of user intent instead (`pointermove`, `pointerdown`, `touchstart`, `keydown`; once, passive). Real users still get the chunk before their first click completes; a passive load (and Lighthouse) never pays for it.

## Closed overlays are free chunk splits

Dynamically import the internals of any closed-by-default overlay (e.g. a search dialog and its fuzzy-search library). The chunk loads on first open; costs nothing visually. Confirm the overlay actually unmounts children while closed before relying on this.

## Keep env validation out of client bundles (two proven fixes)

**Symptom:** a typed env module (a zod-backed env schema) imported transitively by client-reachable modules (Sanity image URL helpers) pulls all of zod (~30KB+ / a 64KB transfer chunk, 78% unused) into every client bundle to read two constant strings. No `"use client"` file imported it directly; **trace transitive imports, not just direct ones**.

Two proven fixes, pick one:

- In client-reachable modules, read `import.meta.env.PUBLIC_*` directly; Astro (Vite) inlines these at build time and the build-time validation in `src/lib/env.ts` still guarantees existence: `projectId: import.meta.env.PUBLIC_SANITY_PROJECT_ID as string`.
- Switch `env.ts` to `zod/mini` (tree-shakable, a few KB, Standard Schema compatible so t3-oss accepts it). API differences: `z.optional(z.string())` instead of `.optional()`, `.check(z.refine(fn, msg))` instead of `.refine()`.

**Sweep rule:** `grep -rln 'lib/env'` across `src/`; check each hit for a module that a `.astro` `<script>` can reach, directly or transitively. Server-only modules are free to import it.

## The module discovery chain (hoisted scripts)

Every component `<script>` becomes its own module entry, and Astro emits no `modulepreload` for the
modules those entries import. The browser therefore discovers shared helpers one hop at a time: an
entry, then `intro`, then `content-ready`, each a full round-trip for a sub-kilobyte file. The
symptom is DOMContentLoaded landing 2 to 3 seconds after first paint on a page with **zero** blocking
time, and it grows with the component count: a starter with 13 entries sits at chain depth 2, a
site with 31 was at depth 4.

Diagnose it statically, no server needed: walk `dist/client/_astro/*.js` (or the adapter's output)
from every `*astro_type_script*` entry following `import ... from "./x.js"` and report depth and the
sub-1.5KB shared chunks. Fix it with Rolldown's `codeSplitting.groups` in `astro.config.mjs` (under
`vite.environments.client.build.rollupOptions.output`, the Astro 6+ path; `advancedChunks` is the
older alias and is ignored when both are set). Nothing is listed by name: one `shell` group takes a
`src/lib` module when two or more entries share it (`minShareCount`), it is small (`maxModuleSize`),
and it is first-party all the way down, which `scripts/build/first-party-only.mjs` decides by reading
the module and everything of ours it imports and refusing at the first bare specifier. So the next
helper joins on its own, and a wrapper around a package (`eases`, `scroll-trigger`) stays out and
chunks with what it wraps, reaching only the pages that import it. No vendor group is needed either:
left alone, the bundler already splits GSAP core from its plugins by importer. Re-run the walk after
building: the helper chunks should be gone.

Two dead ends worth not repeating. A hand-kept allowlist of helpers rots the moment a helper is
added; a size rule without the first-party check captures the 1KB `scroll-trigger.ts` wrapper and
puts the 42KB plugin on every page. `entriesAware: true` separates correctly but shatters the
everyone-shell into several sub-chunks, and raising `entriesAwareMergeThreshold` merges heavy
pieces into broad chunks instead. `includeDependenciesRecursively: false` is rejected outright under
Astro's `preserveEntrySignatures: "exports-only"`.

Local HTTP/1.1 exaggerates the effect (31 entries also queue behind six connections); the depth is
what survives to HTTP/2 production, so accept it against PSI on the deployed URL.

## Resource hints

`preconnect` the media/API CDNs and `prefetchDNS` analytics, emitted from the server layout via `react-dom` so the hints ship in the HTML:

```tsx
import { preconnect, prefetchDNS } from 'react-dom'
preconnect('https://cdn.sanity.io')
prefetchDNS('https://cloud.umami.is')
```

## Analytics scoping

Trackers sending from localhost/preview return errors into the console (caps Best Practices at 96) and pollute analytics. Derive allowed hostnames from the canonical URL and skip the script on localhost:

```tsx
function umamiDomains(): string | null {
  const apex = new URL(env.PUBLIC_SITE_URL).hostname.replace(/^www\./, '')
  if (apex === 'localhost' || apex === '127.0.0.1') return null
  return `${apex},www.${apex}`
}
// render <Script ... data-domains={trackedDomains} /> only when non-null
```

Transfers to any tracker with a domain allowlist (Umami, Plausible, Fathom).

## Structural patterns worth having everywhere

Here these are already structural rather than opt-in: public pages ship no framework runtime, so there is no hydration to compete with, and the only client JS is the custom elements a page renders.

- **Near-viewport mounting** is `lazyCustomElement` (`src/lib/lazy-hydrate.ts`): a dynamic `import()` thunk behind an IntersectionObserver. The media renderers already use it for the Mux, Lottie, and Rive runtimes. See the `lazy-hydration` skill before adding another call site.
- **Editor-only tooling gated hard**: the Visual Editing overlay must stay behind the draft-mode check in `Web.astro`; a published page ships none of it.
- **Heavy validation loaded at use, not at import**: `ContactFormElement` imports its Zod schema inside the submit handler, so the schema is a separate chunk that only a submitting visitor pays for.
- **Modern browser targets** so the bundler emits modern JS (see `pitfalls.md` on the core-js red herring).

The Next edition's equivalents (`DeferredMount`, `LazyMotion` + `m.*`, `next/dynamic` inside `<React.Suspense>`) solve the same problems for a framework runtime this repo does not have. Do not port them.

---
name: lazy-hydration
description: Defer a custom element's JavaScript (and heavy deps like GSAP) out of the initial bundle until it is about to be used, so the entry chunk stays small. Interaction-gated components (modals, dropdowns, popovers, share menus, filter panels, forms inside overlays) load their module through `lazyCustomElement` in `src/lib/lazy-hydrate.ts`, which code-splits the element behind a dynamic `import()` and hydrates it via an IntersectionObserver when its trigger nears the viewport (touch-safe, unlike hover intent). Use when adding client behavior that is not needed before the visitor reaches for it, or when trimming the initial JS of a public page.
---

# Lazy hydration

Public pages ship no framework runtime, but every `<script>` in a component still bundles its module into that page's JavaScript and runs it on load. For interactivity that is not needed until the visitor reaches for it (an overlay, a menu, a form in a modal), defer the module so it stays out of the initial/entry bundle and loads as its own chunk when it is about to be used.

This is the vanilla-custom-element equivalent of Astro's `client:visible`. Astro's `client:*` directives only apply to UI-framework components (React, Vue, Svelte, Lit, etc.), never to the vanilla custom elements used on public pages, so we do it ourselves with a shared helper.

## Core Rules

- The helper is `lazyCustomElement(hostSelector, () => import("./NameElement"), resolveTarget?)` in `src/lib/lazy-hydrate.ts`. It replaces the eager `import "./NameElement"` in the component's `.astro` `<script>`.
- The dynamic `import()` is what code-splits the element (and its deps, e.g. GSAP) into a separate chunk. A static `import` would fold it back into the entry bundle, so always pass a thunk: `() => import("./NameElement")`.
- Hydration is visibility-based (IntersectionObserver, `256px` rootMargin), not hover/pointer intent. On touch there is no hover and `pointerdown` races the first tap; observing visibility means the module is loaded before a tap can land.
- The module loads once. Its guarded `customElements.define` (see `custom-elements`) then upgrades every current and future instance in place, so the element file is unchanged.
- `resolveTarget` picks the observed element from each host; it defaults to the host itself. Observe the visible thing the visitor reaches for, never a permanently `display:none` node.
- The helper re-observes on `astro:page-load`, so it keeps working across view-transition navigations even though a bundled module script executes only once per session. Do not add your own `astro:page-load` wiring on top.
- Progressive enhancement is unchanged: server-render the full markup and keep any native baseline (e.g. `<details>`) working before the enhancement loads.

## Trigger Conditions

Apply when adding client behavior to a public page that is not needed before interaction, when converting an eager `import "./NameElement"`, or when the user asks to shrink a page's initial JavaScript.

## Defer vs. load eagerly

Defer (use `lazyCustomElement`):

- Overlays and popups: modals, dialogs, dropdowns, share menus, tooltips-on-click.
- Panels opened by a control: filter panels, accordions inside them, nav menus.
- Forms that live inside an overlay (observe the overlay's trigger, not the hidden form).

Load eagerly (plain `import "./NameElement"`), because the behavior must be live before any explicit interaction:

- Above-the-fold reveal animations that must be armed before the first paint (`AnimatedText`).
- Always-running animation (a marquee), smooth scroll (`Lenis`), page transitions, sticky chrome.
- Anything cheap and above the fold that must be interactive the instant it paints.

A scroll effect further down the page is the ambiguous case: `InnerParallax` defers, because it has nothing to do until its section approaches the viewport, which is exactly when the observer fires.

## Execution Checklist

1. Build the custom element per `custom-elements` (unchanged: guarded `customElements.define`, tag in `HTMLElementTagNameMap`).
2. In the `.astro` `<script>`, replace `import "./NameElement"` with:
   ```astro
   <script>
     import { lazyCustomElement } from "../../lib/lazy-hydrate";

     lazyCustomElement("name-tag", () => import("./NameElement"), (host) => host.querySelector("[data-name-trigger]"));
   </script>
   ```
3. Choose the observe target: the visible trigger the visitor reaches for. Omit `resolveTarget` when the host element is itself the visible hit area. When the interactive content is hidden until an overlay opens, resolve to that overlay's trigger instead (e.g. `host.closest("some-overlay")?.querySelector("[data-overlay-trigger]") ?? host`).
4. Confirm the native / no-JS baseline still works before the chunk loads.
5. Run `npm run check` and `npm run check.biome`.

## Reference Files

- `src/lib/lazy-hydrate.ts`: the `lazyCustomElement` helper (IntersectionObserver, once-only load, `astro:page-load` re-observe).

Every call site in the repo:

- `src/sanity/media/SanityMuxVideo.astro`: defers the `@mux/mux-player` bundle, which is by far the heaviest media dependency.
- `src/sanity/media/SanityLottie.astro`: defers `@lottiefiles/dotlottie-wc`.
- `src/sanity/media/SanityRive.astro`: defers `./RiveElement` and the Rive canvas runtime behind it.
- `src/components/InnerParallax/InnerParallax.astro`: defers `./InnerParallaxElement`, a scroll effect that only matters once the section is near the viewport.

All four observe the host itself, so none of them passes `resolveTarget`. Reach for `resolveTarget` only when the host is hidden until something else opens it.

## Scope Guidance

- This skill owns the deferral wrapper only. The element itself (lifecycle, state, handlers, registration) is `custom-elements`.
- Which components are page-scoped is automatic: Astro bundles a component's script only onto pages that render it. This skill is about deferring within a page, not across pages.
- Fetching to an endpoint is `server`; styling is `tailwind`; language style is `code-style`.

## Non-Goals

- Deferring behavior that must run before interaction (see Defer vs. load eagerly). Do not lazy-load scroll/reveal/always-on effects.
- Hover/pointer intent hydration: rejected because it fails on touch.
- Astro `client:*` directives: they need a UI-framework renderer and do not apply to vanilla custom elements here.
- Per-file `astro:page-load` wiring or hand-rolled observers: use the shared helper.

## Done Criteria

- The component's `.astro` `<script>` calls `lazyCustomElement` with a dynamic `import()` thunk; no eager `import "./NameElement"` remains.
- The observed target is a rendered, visible element (the trigger), not a permanently hidden node.
- The element module and its heavy deps land in a separate chunk, out of the page's entry bundle.
- The feature works server-rendered (and via any native fallback) before the chunk loads, and after a view-transition navigation.

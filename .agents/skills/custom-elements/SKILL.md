---
name: custom-elements
description: The vanilla-TypeScript custom HTML element pattern for all client behavior on public pages. A PascalCase folder pairs `Component.astro` (server-rendered markup, kebab-case tag, a `<script>` that only imports the element) with `ComponentElement.ts` (an `HTMLElement` subclass). Covers lifecycle (connected/disconnected), private `#field` state from `data-*` hooks, arrow-function handlers, the `customElements.define` guard, nested custom elements (`queryUpgraded`, the post-swap upgrade order), progressive enhancement, fetch-to-API, and accessibility hooks (aria-live, sr-only, honeypot, pre-paint guards). React must never be used here. Use when adding or editing interactivity on a public Astro page.
---

# Custom elements

All interactivity on public pages is a vanilla custom HTML element. There is no React, no framework runtime, and no inline `<script>` logic on these pages. React exists only in the Sanity Studio (`sanity/`) and must never be used here.

## Core Rules

- File layout: a component with no companion files is a flat `src/components/Component.astro` (e.g. `Button.astro`). A component with client behavior is a PascalCase folder pairing `Component.astro` with `ComponentElement.ts` exporting `class ComponentElement extends HTMLElement`. Use a folder, too, when the component has other companions (sub-components, or scoped assets like the SVGs in `Icon/`). The folder is PascalCase only while it is purely a component bundle; once it also owns a data layer (a `query.ts` or `fragment.ts`) it becomes a kebab-case module folder with the same files inside, like `site-header/SiteHeader.astro`. See `code-style`.
- The `.astro` `<script>` only imports the element module (or defers it with `lazyCustomElement`; see `lazy-hydration`). No other logic in the `.astro` script.
- The custom-element tag is kebab-case (`<contact-form>`). Target behavior with `data-*` hooks; style with classes.
- Private `#field` state, initialized in `connectedCallback` from typed `querySelector`s. Never query in the constructor (the DOM is not ready).
- Never trust a bare `instanceof` on a nested custom element in `connectedCallback`: after a `<ClientRouter />` swap the descendant has not upgraded yet and the check fails silently. Use `queryUpgraded`/`queryAllUpgraded` from `~/lib/query-upgraded`, or look the element up lazily at call time. See "Nested custom elements" below.
- Event handlers are arrow-function class fields so `addEventListener` and `removeEventListener` share one reference.
- Wire listeners in `connectedCallback`; tear every one down in `disconnectedCallback`.
- Guard registration: `if (!customElements.get("tag")) { customElements.define("tag", Element); }`.
- Progressive enhancement: server-render the full content; the element only shows/hides, fetches, or syncs. Pages work without JS.
- Scroll is native-only: listen on `window`/`document` `scroll` events and let ScrollTrigger use its default scroller. Never reach for the Lenis instance (`lenis.on("scroll", ...)`, `new Lenis()`): Lenis drives the real scroller, so native listeners behave identically with or without it, and `<Lenis />` is not mounted in draft mode (the Presentation preview). Scroll locking goes through the `lenis-scroll` element's `stop()`/`start()`. Only `src/components/Lenis/` imports `lenis`; Biome (`noRestrictedImports`) enforces this.
- No React. No JSX. No client framework on public pages.

## Trigger Conditions

Apply when adding interactivity to a public Astro page, editing a `*Element.ts`, or when the user asks for client behavior: forms, filtering, fetching, dynamic updates, progressive enhancement.

## Execution Checklist

1. Create or confirm the pair: `src/components/Name/Name.astro` and `src/components/Name/NameElement.ts`.
2. `.astro`: render markup with a kebab-case tag and `data-*` hooks; end with `<script>import "./NameElement";</script>`.
3. Element: extend `HTMLElement`; declare state as `#field: T | null = null`; init in `connectedCallback`; tear down in `disconnectedCallback`.
4. Handlers are arrow-function fields; selectors are typed (`querySelector<HTMLFormElement>("[data-form]")`).
5. Guard the `customElements.define` call.
6. Add the tag to `HTMLElementTagNameMap` in `src/env.d.ts`.
7. Run `npm run check` and `npm run check.biome`.

## Scope Guidance

- This skill owns the client-behavior pattern and progressive enhancement.
- Language-level style (braces, naming, comments): `code-style`.
- Classes, tokens, `<style>` policy, z-index: `tailwind`.
- The markup's place in a page, layouts, frontmatter logic: `astro`.
- Deferring an element's module out of the entry bundle: `lazy-hydration`.
- Fetching to a server endpoint hits the API conventions in `server`.

## Non-Goals

- Any React, JSX, or client framework on public pages.
- Inline behavior in the `.astro` `<script>` (it only imports the element).
- State outside private `#fields`; listeners added without teardown.
- Styling rules (those live in `tailwind`).

## Done Criteria

- The element extends `HTMLElement` with `connectedCallback` setup and `disconnectedCallback` teardown.
- All state is private `#fields` initialized from `[data-*]` hooks via typed selectors.
- Every handler is an arrow-function field; every listener added is removed.
- Registration is guarded; the tag is in `HTMLElementTagNameMap`.
- Any nested custom element reference checked in `connectedCallback` goes through `queryUpgraded`/`queryAllUpgraded` or a call-time lookup, never a bare `instanceof`.
- The feature works server-rendered before the element upgrades (progressive enhancement).

## Reference Files

Every custom element in the repo, and what each one demonstrates:

- `src/features/forms/form-element.ts`: the `FormElement` base class every form extends. Submit, fetch to an internal endpoint, honeypot timing, inline per-field errors, and a schema chunk loaded on demand, all in one place; `ContactFormElement.ts` is the thin subclass. See `docs/features/forms.md`.
- `src/components/AnimatedText/AnimatedText.astro`, `AnimatedTextElement.ts`: line, word or char reveal on `kugiri` (the painted-line splitter, from npm), animated with the Web Animations API and gated on fonts, page transition, and viewport.
- `src/components/InnerParallax/InnerParallax.astro`, `InnerParallaxElement.ts`: scroll-driven transform, deferred through `lazyCustomElement`.
- `src/components/Lenis/Lenis.astro`, `LenisElement.ts`: the smooth-scroll driver over the document. Mounted only outside draft mode, which is why nothing else may depend on the instance (see the scroll rule above).
- `src/components/Dialog/Dialog.astro`, `DialogElement.ts`: the reusable modal, on the native `<dialog>`; `showModal()` does the focus containment, the element owns the transitions, Escape, the backdrop press and the scroll lock.
- `src/features/blog/author/AuthorDialog.astro`, `AuthorDialogElement.ts`: a host that drives a `Dialog` through navigation, so a byline opens the author's real URL as a panel. See `docs/features/dialogs-and-overlay-routes.md`.
- `src/sanity/media/SanityRive.astro`, `RiveElement.ts`: a canvas renderer whose heavy dependency loads as its own chunk.
- `src/env.d.ts`: the `HTMLElementTagNameMap` declaration for every tag above.
- `src/lib/query-upgraded.ts`: the typed nested-element lookup; every `instanceof SomeElement` on a queried node goes through it.

## Detailed conventions

### The pair

```astro
---
type Props = {
  endpoint: string;
};

const { endpoint } = Astro.props;
---

<contact-form class="block max-w-lg">
  <form method="post" action={endpoint} class="flex flex-col gap-24">
    <!-- ...fields... -->
    <p data-form-message role="status" aria-live="polite" class="hidden text-caption"></p>
  </form>
</contact-form>

<script>
  import "./ContactFormElement";
</script>
```

```ts
export class ContactFormElement extends HTMLElement {
  #form: HTMLFormElement | null = null;
  #message: HTMLElement | null = null;

  // Arrow-function field: same reference for add/removeEventListener.
  #onSubmit = (event: SubmitEvent) => {
    event.preventDefault();
    // ...
  };

  connectedCallback() {
    this.#form = this.querySelector<HTMLFormElement>("form");
    this.#message = this.querySelector<HTMLElement>("[data-form-message]");

    this.#form?.addEventListener("submit", this.#onSubmit);
  }

  disconnectedCallback() {
    this.#form?.removeEventListener("submit", this.#onSubmit);
  }
}

if (!customElements.get("contact-form")) {
  customElements.define("contact-form", ContactFormElement);
}
```

### Lifecycle and state

- Declare every field as `#name: T | null = null`. Initialize in `connectedCallback`; the constructor runs before the DOM exists.
- `connectedCallback`: query all `[data-*]` targets, read any initial state (URL, attributes), wire listeners, then reveal.
- `disconnectedCallback`: remove every listener, abort in-flight work (`AbortController`), and call `destroy()` on heavy resources (for example a long-lived timer, observer, or animation).

### Handlers

Arrow-function class fields only. A plain method loses `this` and yields a new reference each access, so `removeEventListener` would not match.

```ts
// Correct
#onReset = (event: Event) => { event.preventDefault(); this.#clear(); };

// Wrong: `this` is lost, and the reference differs each call
#onReset(event: Event) { this.#clear(); }
```

### Typed selectors and data hooks

- Style with classes; find behavior targets with `data-*` attributes, not IDs.
- Always pass the element type: `this.querySelector<HTMLInputElement>("[data-filter]")`, `Array.from(this.querySelectorAll<HTMLElement>("[data-card]"))`.

### Registration and the tag map

- Guard `customElements.define` so a double import (HMR, repeated include) does not throw.
- Add each tag to `HTMLElementTagNameMap` in `src/env.d.ts` for template type-checking.

### Nested custom elements

When one custom element needs another custom element nested inside it (to call its methods or set
its properties), plain `querySelector` + `instanceof` is a trap. On a fresh page load it works,
because import order defines the inner element first and upgrades every host in the document. After
a `<ClientRouter />` page swap it does not: the incoming document is parsed detached (nothing
upgrades there), and on insertion upgrades run in tree order, ancestors first. The owner's
`connectedCallback` runs while the descendant is still a plain `HTMLElement`, the `instanceof`
check fails silently, and the cached reference is `null` for the life of that document.

In order of preference:

1. Don't reach into a descendant's custom-element API at all. Communicate through attributes and
   events, and let the descendant drive itself.
2. Look the element up lazily, at call time, from an event handler. Interaction happens long after
   the upgrade queue drains, so the check is safe there. A typed cast cached at connect and only
   called from handlers also stays safe: the node upgrades in place, so the reference stays good.
3. When the reference must be cached and checked at connect, use the helpers:

```ts
import { queryUpgraded, queryAllUpgraded } from "~/lib/query-upgraded";

const dialog = queryUpgraded(this, "modal-dialog", DialogElement); // T | null
const hosts = queryAllUpgraded(row, "animated-text", AnimatedTextElement); // T[]
```

Both upgrade the match before the `instanceof` check, which also runs the descendant's
`connectedCallback` synchronously, so the caller gets a fully initialized element. Passing the class
guarantees the tag is defined: importing the element module is what defines it. This also means the
helpers do not fit a deliberately lazy-loaded element (a type-only import): there, gate on
`customElements.whenDefined(tag)` and look the element up in the `.then`.

Two lookalike fixes that do not work:

- `customElements.whenDefined()` alone resolves immediately when the class is already defined; the
  instance just has not upgraded.
- `el?.method()` guards the element being `null`, not it being un-upgraded; pre-upgrade the method
  does not exist and the call throws.

### Progressive enhancement

- Server-render the complete DOM (every card, every field). The element enhances: it toggles `hidden`, fetches to populate, or syncs the URL. It never creates essential content.
- Filtering shows/hides server-rendered nodes (`card.hidden = !match`); it does not remove or recreate them.

### Client filtering and URL state

No component in the repo filters client-side yet. If you add one: two-way sync, where a form change updates `URLSearchParams` via `history.replaceState`, and on load the URL is read back into the form and then applied. Filtering shows and hides server-rendered nodes; it never rebuilds the list.

### Fetch to an internal API

- `preventDefault`, then `fetch` the internal endpoint with a JSON body (not `FormData`); check `response.ok && result.ok`.
- Disable the submit button during the request; re-enable in `finally`.
- Push human-readable progress to a `role="status" aria-live="polite"` element. See `server` for the endpoint side.

### Accessibility hooks

- Dynamic text (counts, statuses) lives in an `aria-live="polite"` element, often `role="status"`. Updating its `textContent` announces the change.
- Visually hidden but readable content uses the `sr-only` class. Hide decorative or trap content from assistive tech with `aria-hidden="true"`.
- Honeypot anti-spam: a visually hidden, `aria-hidden`, `tabindex="-1"`, `autocomplete="off"` field with a legit-sounding name (the `website` input in `ContactFormSection.astro`, named by `HONEYPOT_FIELD_NAME` in `src/features/spam-prevention/constants.ts`). The server treats it as spam when filled (see `server`).
- Prefer native form validation (`required`, `type="email"`, `maxlength`); surface custom errors through the aria-live status element.

### Pre-paint flash guards

- When a page can load in an already-modified state (the URL carries params the element will act on), an inline `<script is:inline>` may set a `data-*` flag before paint that a Tailwind `data-*:hidden` variant hides, with the element clearing it once applied. Keep such inline scripts tiny and add a timeout safety net so content is never stuck hidden. Nothing in the repo needs one today.

### Large lists

- For a big server-rendered list, `content-visibility: auto` with `contain-intrinsic-size` lets off-screen items skip paint while staying in the DOM for filtering.

### What to use instead of React

| React habit            | Here                                                      |
| ---------------------- | --------------------------------------------------------- |
| `useState`             | private `#field` set in `connectedCallback`               |
| props                  | Astro frontmatter plus `data-*` attributes                |
| `onClick` / `onChange` | `addEventListener` with arrow-field handlers              |
| `useEffect` cleanup    | `connectedCallback` / `disconnectedCallback`              |
| conditional JSX        | Astro frontmatter logic plus thin templates (see `astro`) |

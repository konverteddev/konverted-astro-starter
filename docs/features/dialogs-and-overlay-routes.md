# Dialogs and overlay routes

Two things live here. `Dialog` is a reusable accessible modal you can drop on any page. The blog's
author panel is the pattern built on top of it: a link that opens as an overlay over the page you are
already on, while the URL, Back, sharing and a reload all behave as if you had gone to the linked
page. Because, without JavaScript, you do.

## Dialog

`src/components/Dialog/Dialog.astro` plus `src/components/Dialog/DialogElement.ts` (tag `modal-dialog`).

```astro
---
import Dialog from '~/components/Dialog/Dialog.astro'
---

<Dialog labelledBy="settings-title">
  <h2 id="settings-title">Settings</h2>
  <p>…</p>
</Dialog>
```

| Prop         | Default    | Notes                                                                             |
| ------------ | ---------- | --------------------------------------------------------------------------------- |
| `labelledBy` | -          | id of the heading that names the panel. Pass one whenever the content has a heading |
| `label`      | -          | Fallback name for a panel with no heading of its own                               |
| `placement`  | `"center"` | `"center"` is a centred card; `"side"` is a full-height sheet from the right       |
| `closeLabel` | `"Close"`  | Accessible name of the close button                                                |
| `class`      | -          | Merged onto the panel with `cx`                                                    |

It ships closed. Open it from any element that has a reference to it:

```ts
const dialog = document.querySelector<DialogElement>('modal-dialog')

dialog.returnFocusTo = trigger
dialog.show()
```

### Element API

- `show()` / `hide()` open and close the panel, playing the entrance and exit.
- `requestClose()` is what the close button, Escape and a backdrop press call. If a host set
  `onCloseRequest`, that runs instead of `hide()`, so closing can be something other than hiding
  (a navigation, for instance).
- `isOpen`, `content` (the scrolling region a host can fill), `returnFocusTo` (where focus lands
  after the exit; unset leaves it to the browser).
- Events: `dialog:open` and `dialog:close` on the `<modal-dialog>` element.

### Why the native `<dialog>`

`showModal()` is what makes this accessible with no library: the rest of the document becomes inert,
so focus and the accessibility tree are confined to the panel. There is no JS focus trap to ship or
to get wrong. What the element adds is the parts the platform leaves open:

- **The transitions.** A `<dialog>` is `display: none` until it opens, so a transition from the
  closed state would be skipped. `data-open` is set one frame after `showModal()`, and `close()` is
  delayed by `EXIT_MS` on the way out so the exit can run. **`EXIT_MS` in the element and the
  `duration-*` classes in `Dialog.astro` are one decision in two places; change them together.**
- **Escape.** Escape reaches the dialog as `cancel`, which closes it outright. The element cancels
  that and routes it through `requestClose()` so the exit plays. It also listens for the native
  `close`: Chrome skips the cancellable `cancel` when Escape arrives with no user activation behind
  it, and the teardown has to happen anyway.
- **The backdrop press.** Both ends of the click must land on the backdrop, so a selection dragged
  out of the panel and released outside it does not close it.
- **The page scroll lock**, through `lenis-scroll`'s `stop()` / `start()` plus `overflow: hidden` on
  `<html>`. The dialog's own content region carries `data-lenis-prevent` so it still scrolls.

## Overlay routes

A byline on an article is a plain `<a href="/blog/authors/demo-author">`. With JavaScript, clicking
it opens the author as a panel over the article and the URL becomes `/blog/authors/demo-author`.
Reload, share or crawl that URL and you get the author's own page. Nothing is a fallback for
anything: the page is the real thing and the panel is a view of it.

### The parts

| File                                                | Role                                                                                             |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `src/pages/blog/authors/[slug].astro`               | The author's own page. Portrait, bio, links, and the articles they wrote                          |
| `src/pages/blog/authors/[slug]/modal.astro`         | The same profile as an HTML fragment (`export const partial = true`), sent `X-Robots-Tag: noindex` |
| `src/features/blog/author/AuthorProfile.astro`      | The profile itself, rendered by both of the above                                                 |
| `src/features/blog/author/AuthorLink.astro`         | The byline link, marked `data-author-link`                                                        |
| `src/features/blog/author/AuthorDialog.astro`       | `<author-dialog>` wrapping a side-placement `Dialog`, mounted once per article                    |
| `src/features/blog/author/AuthorDialogElement.ts`   | The URL layer: intercepts the click, fetches the partial, drives the panel                        |

### How a click becomes a panel

1. The element catches the click on `[data-author-link]` in the **capture** phase, because
   `<ClientRouter />` answers the same click on the way up and would navigate first.
2. It calls Astro's `navigate()`, so this is a real navigation with a real history entry.
3. On `astro:before-preparation` it claims the navigation and **replaces the loader**. Nothing sets
   `newDocument`, so it stays the current document and the swap has nothing to replace.
4. The loader fetches `/blog/authors/<name>/modal`, writes it into the dialog's content region, and
   shows the panel. Hovering or focusing the byline warms that fetch first, so the panel opens on the
   same frame as the click.
5. Closing is `history.back()`, which the element claims the same way and answers by hiding the panel.

A failed fetch falls back to `location.href = pathname`, which is where the link pointed anyway.

### The page has to opt in

The article page declares two attributes (see `src/pages/blog/[slug].astro`):

```astro
<article data-page-in-place-family={`${uri} ${SANITY_AUTHOR_PATH_PREFIX}`} data-page-in-place-scope>
```

`data-page-in-place-family` is a space-separated list of URL roots one page answers without changing
what the reader is looking at. A navigation counts as in-place only when **both** ends fall inside
the family, so the article's own URL plus `/blog/authors` covers opening the panel and closing it,
while a link to a different article is still a page change. `data-page-in-place-scope` is what an
in-place navigation is recognised by. See [View transitions](./view-transitions.md).

**Mount the dialog outside the scope.** An in-place navigation that really does swap replaces the
scope element, which would take the panel with it.

## Reusing the pattern

To give another document type the same treatment:

1. Add a prefix route and a sibling `modal.astro` partial for it, both rendering one shared profile
   component.
2. Copy `src/features/blog/author/` as a starting point; the element is about a hundred lines and the
   only document-specific parts are the path predicate in `constants.ts` and the link attribute.
3. On the host page, mount the dialog outside the scope and declare the family as
   `<host uri> <prefix>`.

Keep the panel a **view of a page that exists**. That is what makes the URL shareable, the content
indexable once rather than twice, and the whole thing work with JavaScript off.

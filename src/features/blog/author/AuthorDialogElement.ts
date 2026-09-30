import { navigate, type TransitionBeforePreparationEvent } from "astro:transitions/client";
import { DialogElement } from "~/components/Dialog/DialogElement";
import { AUTHOR_LINK_ATTR, authorPartialPath, isAuthorPath } from "~/features/blog/author/constants";
import { queryUpgraded } from "~/lib/query-upgraded";
// For the side effect: this module decides whether a navigation swaps the document (see the host page's family attribute).
import "~/lib/transitions/in-place";
import { isRealHover } from "~/lib/utils";

/** A byline click is a real `navigate()` answered with a fragment, so URL, Back and reload behave as a real page visit. */
export class AuthorDialogElement extends HTMLElement {
  #dialog: DialogElement | null = null;
  #hostPath = "";

  /** Kept as the promise, so a double click shares one request. */
  #partials = new Map<string, Promise<string>>();

  #authorLink(target: EventTarget | null): HTMLAnchorElement | null {
    if (!(target instanceof Element)) {
      return null;
    }

    const link = target.closest<HTMLAnchorElement>(`[${AUTHOR_LINK_ATTR}]`);

    if (!link) {
      return null;
    }

    const url = new URL(link.href, location.href);

    return url.origin === location.origin && isAuthorPath(url.pathname) ? link : null;
  }

  #onClick = (event: MouseEvent) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }

    const link = this.#authorLink(event.target);

    if (!link || !this.#dialog) {
      return;
    }

    event.preventDefault();

    this.#dialog.returnFocusTo = link;
    void navigate(new URL(link.href).href);
  };

  // Warming on intent is enough for the panel to open on the same frame as the click.
  #onIntent = (event: Event) => {
    if (!isRealHover(event)) {
      return;
    }

    const link = this.#authorLink(event.target);

    if (link) {
      void this.#partial(new URL(link.href).pathname).catch(() => undefined);
    }
  };

  #onBeforePreparation = (event: Event) => {
    const preparation = event as TransitionBeforePreparationEvent;

    if (!this.#claims(preparation.to)) {
      return;
    }

    // Replacing the loader stops the router fetching a document: nothing sets `newDocument`, so the swap has nothing to replace.
    preparation.loader = async () => {
      await this.#apply(preparation.to);
    };
  };

  /** True when this navigation opens or closes the panel rather than changing the page. */
  #claims(to: URL): boolean {
    if (to.origin !== location.origin) {
      return false;
    }

    if (isAuthorPath(to.pathname)) {
      return true;
    }

    return Boolean(this.#dialog?.isOpen) && to.pathname === this.#hostPath;
  }

  async #apply(to: URL) {
    if (!isAuthorPath(to.pathname)) {
      this.#dialog?.hide();
      return;
    }

    await this.#open(to.pathname);
  }

  #partial(pathname: string): Promise<string> {
    const cached = this.#partials.get(pathname);

    if (cached) {
      return cached;
    }

    const request = fetch(authorPartialPath(pathname))
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Author partial responded ${response.status}`);
        }

        return response.text();
      })
      .catch((error) => {
        // A failed fetch must not become the answer every later click gets.
        this.#partials.delete(pathname);
        throw error;
      });

    this.#partials.set(pathname, request);

    return request;
  }

  /** Falls back to the author's own page if the fetch fails, which is where the link pointed anyway. */
  async #open(pathname: string) {
    const dialog = this.#dialog;

    if (!dialog) {
      return;
    }

    try {
      const html = await this.#partial(pathname);

      if (dialog.content) {
        dialog.content.innerHTML = html;
      }

      dialog.show();
    } catch {
      location.href = pathname;
    }
  }

  #onDialogClose = () => {
    if (this.#dialog?.content) {
      this.#dialog.content.innerHTML = "";
    }
  };

  connectedCallback() {
    const dialog = queryUpgraded(this, "modal-dialog", DialogElement);

    this.#hostPath = this.dataset.hostPath ?? location.pathname;

    if (dialog) {
      this.#dialog = dialog;
      // Closing is a navigation: the URL has to leave with the panel.
      dialog.onCloseRequest = () => history.back();
      dialog.addEventListener("dialog:close", this.#onDialogClose);
    }

    // On the document, in the capture phase: <ClientRouter /> answers the same click on the way up and would navigate first.
    document.addEventListener("click", this.#onClick, { capture: true });
    document.addEventListener("pointerover", this.#onIntent);
    document.addEventListener("focusin", this.#onIntent);
    document.addEventListener("astro:before-preparation", this.#onBeforePreparation);
  }

  disconnectedCallback() {
    document.removeEventListener("click", this.#onClick, { capture: true });
    document.removeEventListener("pointerover", this.#onIntent);
    document.removeEventListener("focusin", this.#onIntent);
    document.removeEventListener("astro:before-preparation", this.#onBeforePreparation);

    if (this.#dialog) {
      this.#dialog.removeEventListener("dialog:close", this.#onDialogClose);
      this.#dialog.onCloseRequest = null;
      this.#dialog = null;
    }

    this.#partials.clear();
  }
}

if (!customElements.get("author-dialog")) {
  customElements.define("author-dialog", AuthorDialogElement);
}

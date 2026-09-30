import { hasCookie, setCookie } from "~/lib/cookies";
import { ANNOUNCEMENT_COOKIE_MAX_AGE, ANNOUNCEMENT_COOKIE_NAME } from "./dismissal";

/**
 * The announcement bar closes, and that is all: whether its line has to scroll is for the `Marquee`
 * its content sits in to decide.
 */
export class SiteAnnouncementElement extends HTMLElement {
  #closeButton: HTMLButtonElement | null = null;

  #onClose = () => {
    setCookie(ANNOUNCEMENT_COOKIE_NAME, "1", ANNOUNCEMENT_COOKIE_MAX_AGE);

    this.remove();
  };

  connectedCallback() {
    // The inline guard in the markup already covers the first paint; this covers a client-side
    // navigation, where the bar is swapped back in after it was closed on the previous page.
    if (hasCookie(ANNOUNCEMENT_COOKIE_NAME)) {
      this.remove();
      return;
    }

    this.#closeButton = this.querySelector<HTMLButtonElement>("[data-announcement-close]");
    this.#closeButton?.addEventListener("click", this.#onClose);
  }

  disconnectedCallback() {
    this.#closeButton?.removeEventListener("click", this.#onClose);
    this.#closeButton = null;
  }
}

if (!customElements.get("site-announcement")) {
  customElements.define("site-announcement", SiteAnnouncementElement);
}

// Flips `data-submit-state` on the button `SubmitButton.astro` renders, keeps the accessible name pointing
// at the state on screen, and holds "done" long enough to be read.
export type SubmitStateName = "idle" | "pending" | "done";

const DONE_HOLD_MS = 2400;

export class SubmitState {
  #button: HTMLButtonElement | null;
  #timer = 0;

  constructor(form: HTMLElement) {
    this.#button = form.querySelector<HTMLButtonElement>("[data-submit-state]");
  }

  pending() {
    this.#set("pending");
  }

  done() {
    this.#set("done");
    this.#timer = window.setTimeout(() => this.#set("idle"), DONE_HOLD_MS);
  }

  idle() {
    this.#set("idle");
  }

  destroy() {
    window.clearTimeout(this.#timer);
  }

  #set(state: SubmitStateName) {
    const button = this.#button;

    if (!button) {
      return;
    }

    window.clearTimeout(this.#timer);
    button.dataset.submitState = state;

    const label = button.querySelector<HTMLElement>(`[data-submit-label="${state}"]`);

    button.setAttribute("aria-label", label?.textContent?.trim() ?? "");
  }
}

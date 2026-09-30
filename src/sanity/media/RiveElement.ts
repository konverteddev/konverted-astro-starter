import { EventType, Fit, Layout, Rive } from "@rive-app/canvas";

// A machine must be named: with `stateMachines` omitted the 2.38 runtime plays it once then freezes
// instead of idling. "State Machine 1" is Rive's editor default; the CMS `stateMachine` field overrides it.
const DEFAULT_STATE_MACHINE = "State Machine 1";

export class RiveElement extends HTMLElement {
  #rive: Rive | null = null;
  #canvas: HTMLCanvasElement | null = null;
  #observer: IntersectionObserver | null = null;
  #inView = false;
  #loaded = false;

  // Resource-saving policy: only autoplay while visible.
  #sync = () => {
    if (!this.#rive || !this.#loaded) {
      return;
    }

    if (this.#inView && this.hasAttribute("autoplay")) {
      this.#rive.play();
      return;
    }

    this.#rive.pause();
  };

  // Loop on restarts when the machine reports a stop while in view; loop off stops after the first loop event.
  #onStop = () => {
    if (this.hasAttribute("loop") && this.#inView && this.hasAttribute("autoplay")) {
      this.#rive?.play();
    }
  };

  #onLoop = () => {
    if (!this.hasAttribute("loop")) {
      this.#rive?.stop();
    }
  };

  #onResize = () => {
    this.#rive?.resizeDrawingSurfaceToCanvas();
  };

  connectedCallback() {
    this.#canvas = this.querySelector("canvas");
    const src = this.getAttribute("src");

    if (!this.#canvas || !src) {
      return;
    }

    this.#rive = new Rive({
      src,
      canvas: this.#canvas,
      stateMachines: this.getAttribute("data-state-machine") || DEFAULT_STATE_MACHINE,
      autoplay: false,
      // Runtime >= 2.38 no longer binds implicitly, and data-binding files render nothing without it.
      autoBind: this.hasAttribute("data-auto-bind"),
      layout: new Layout({ fit: Fit.Contain }),
      onLoad: () => {
        this.#rive?.resizeDrawingSurfaceToCanvas();
        this.#loaded = true;
        // Reveal only once fully loaded (wasm + .riv + first frame) so a blank canvas never flashes.
        this.#canvas?.classList.remove("opacity-0");
        this.#sync();
      },
    });

    this.#rive.on(EventType.Stop, this.#onStop);
    this.#rive.on(EventType.Loop, this.#onLoop);

    this.#observer = new IntersectionObserver((entries) => {
      this.#inView = entries.some((entry) => entry.isIntersecting);
      this.#sync();
    });
    this.#observer.observe(this);

    window.addEventListener("resize", this.#onResize);
  }

  disconnectedCallback() {
    window.removeEventListener("resize", this.#onResize);
    this.#observer?.disconnect();
    this.#observer = null;
    this.#rive?.off(EventType.Stop, this.#onStop);
    this.#rive?.off(EventType.Loop, this.#onLoop);
    this.#rive?.cleanup();
    this.#rive = null;
    this.#canvas = null;
    this.#loaded = false;
  }
}

if (!customElements.get("rive-canvas")) {
  customElements.define("rive-canvas", RiveElement);
}

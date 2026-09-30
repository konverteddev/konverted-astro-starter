// The router only saves scroll into history once scrolling fully stops, and Lenis's easing tail keeps it
// moving sub-pixel for a second after, so a reload inside that window restores the wrong position.

// Chrome and Safari rate-limit history writes (~100 per 30s), so this stays well under while staying fresh.
const SAVE_MS = 400;

// Quiet time before the trailing stamp records the exact resting position.
const TRAIL_MS = 150;

const save = () => {
  if (!history.state) {
    return;
  }

  history.replaceState({ ...history.state, scrollX: window.scrollX, scrollY: window.scrollY }, "");
};

let lastSave = 0;
let trailing = 0;

addEventListener(
  "scroll",
  () => {
    const index = history.state?.index;
    const now = performance.now();

    if (now - lastSave >= SAVE_MS) {
      lastSave = now;
      save();
    }

    clearTimeout(trailing);
    trailing = window.setTimeout(() => {
      // A client-side navigation landed in the meantime; its entry's scroll is Astro's to record.
      if (history.state?.index !== index) {
        return;
      }

      save();
    }, TRAIL_MS);
  },
  { passive: true }
);

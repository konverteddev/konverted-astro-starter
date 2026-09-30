// The signal `scripts/section-thumbs/capture.ts` waits on instead of a sleep: fonts settled, images
// decoded, then two frames so the first paint is on screen. Never `customElements.whenDefined`, which
// a lazily hydrated element would leave pending forever.

/** Past this the specimen is photographed as it stands; a signal that never fires is worse than an early one. */
const SETTLE_TIMEOUT = 5000;

/**
 * A response is not a painted pixel: an image still decoding shifts the layout under the capture.
 * A lazy image below the fold never starts loading, and `decode()` on one never settles, so it is
 * left out rather than waited on.
 */
function decoded() {
  const images = [...document.images]
    .filter((image) => image.complete || image.loading !== "lazy")
    .map((image) => {
      if (image.complete && image.naturalWidth > 0) {
        return Promise.resolve();
      }

      return image.decode().catch(() => undefined);
    });

  return Promise.all(images);
}

function settled() {
  return Promise.all([document.fonts.ready, decoded()]).catch(() => undefined);
}

async function signalReady() {
  await Promise.race([settled(), new Promise((resolve) => setTimeout(resolve, SETTLE_TIMEOUT))]);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.documentElement.dataset.ready = "";
    });
  });
}

signalReady();

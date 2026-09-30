const CAPTURE_TIMEOUT_MS = 20_000;
const OUTPUT_TYPE = "image/webp";
const OUTPUT_QUALITY = 0.85;
/** Nudge past 0: some encodings decode a blank frame at exactly 0. */
const DEFAULT_FRAME_TIME = 0.1;

/** Browser only. `toBlob` falls back to PNG where WebP cannot be encoded, so read `blob.type`. */
function captureVideoFrame(url: string, time = DEFAULT_FRAME_TIME): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    let settled = false;

    const cleanup = () => {
      clearTimeout(timer);
      video.removeAttribute("src");
      video.load();
    };

    const fail = (message: string) => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      reject(new Error(message));
    };

    const timer = setTimeout(() => fail("Timed out reading the video."), CAPTURE_TIMEOUT_MS);

    const draw = () => {
      if (settled) {
        return;
      }

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const context = canvas.getContext("2d");

      if (!context || !canvas.width || !canvas.height) {
        fail("Could not read the video frame.");
        return;
      }

      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            fail("Could not encode the video frame.");
            return;
          }

          settled = true;
          cleanup();
          resolve(blob);
        },
        OUTPUT_TYPE,
        OUTPUT_QUALITY
      );
    };

    // Anonymous CORS keeps the canvas untainted, otherwise toBlob throws.
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";

    video.addEventListener("error", () => fail("Could not load the video."));
    video.addEventListener("seeked", draw, { once: true });
    video.addEventListener(
      "loadeddata",
      () => {
        const duration = Number.isFinite(video.duration) ? video.duration : 0;
        const target = Math.min(time, Math.max(duration - 0.05, 0));

        if (Math.abs(video.currentTime - target) < 0.001) {
          // Already on the wanted frame; no `seeked` event is coming.
          draw();
          return;
        }

        video.currentTime = target;
      },
      { once: true }
    );

    video.src = url;
  });
}

export { captureVideoFrame };

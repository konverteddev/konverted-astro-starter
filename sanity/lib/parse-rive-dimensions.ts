type RiveRuntime = Awaited<ReturnType<typeof import("@rive-app/canvas-advanced-single").default>>;

let riveRuntimePromise: Promise<RiveRuntime> | null = null;

async function getRiveRuntime() {
  if (!riveRuntimePromise) {
    riveRuntimePromise = import("@rive-app/canvas-advanced-single").then((mod) => mod.default());
  }

  return riveRuntimePromise;
}

/**
 * Reads width/height from a `.riv` file by loading the default artboard.
 */
export async function parseRiveAssetDimensionsFromBuffer(buffer: ArrayBuffer): Promise<{
  width: number;
  height: number;
} | null> {
  try {
    const rive = await getRiveRuntime();
    const bytes = new Uint8Array(buffer);
    const file = await rive.load(bytes);
    const artboard = file.defaultArtboard();

    if (!artboard) {
      return null;
    }

    const width = Math.round(artboard.width);
    const height = Math.round(artboard.height);

    if (width <= 0 || height <= 0) {
      return null;
    }

    return { width, height };
  } catch {
    return null;
  }
}

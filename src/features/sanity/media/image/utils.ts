import { createImageUrlBuilder, type ImageUrlBuilderOptions } from "@sanity/image-url";
import { DEFAULT_MAX_HEIGHT, DEFAULT_MAX_WIDTH, DEFAULT_SOURCE_WIDTHS } from "~/features/sanity/media/constants";
import type { ImageFragmentResult } from "~/features/sanity/media/fragment";
import { run } from "~/features/utils/common";
import type { SanityImageCrop } from "~/sanity/types";

// Prefer `width` and `height` over their short versions.
export type BuilderOptions = Omit<ImageUrlBuilderOptions, "w" | "h"> & {
  aspectRatio?: number;
  sourceWidths?: number[];
};

type Dimensions = {
  width?: number;
  height?: number;
};

// Inlined `import.meta.env` rather than `~/lib/env`: this module is client-reachable and Vite inlines PUBLIC_* vars.
export const builder = createImageUrlBuilder({
  projectId: import.meta.env.PUBLIC_SANITY_PROJECT_ID as string,
  dataset: import.meta.env.PUBLIC_SANITY_DATASET as string,
});

const defaultBuilderOptions = {
  auto: "format",
  quality: 85,
  maxWidth: DEFAULT_MAX_WIDTH,
  maxHeight: DEFAULT_MAX_HEIGHT,
  sourceWidths: DEFAULT_SOURCE_WIDTHS,
} satisfies BuilderOptions;

function buildImageUrl(image: ImageFragmentResult, options: BuilderOptions = {}) {
  return builder
    .withOptions({ ...defaultBuilderOptions, ...options })
    .image(image)
    .url();
}

function calculateDimensions({ width, height }: Dimensions, aspectRatio?: number, fallbackSize?: Dimensions) {
  if (width && height) {
    return { width, height };
  }

  if (width && !height) {
    return aspectRatio ? { width, height: Math.round(width / aspectRatio) } : { width, height: width };
  }

  if (height && !width) {
    return aspectRatio ? { width: Math.round(height * aspectRatio), height } : { width: height, height };
  }

  if (!fallbackSize) {
    throw new Error("Unable to calculate dimensions. Provide a fallbackSize.");
  }

  return calculateDimensions(fallbackSize, aspectRatio);
}

function applyMaxConstraints(
  dimensions: { width: number; height: number },
  opts: { maxWidth?: number; maxHeight?: number } = {}
) {
  const { maxWidth = DEFAULT_MAX_WIDTH, maxHeight = DEFAULT_MAX_HEIGHT } = opts;

  let width = dimensions.width;
  let height = dimensions.height;

  if (maxWidth && width > maxWidth) {
    const ratio = maxWidth / width;
    width = maxWidth;
    height = Math.round(height * ratio);
  }

  if (maxHeight && height > maxHeight) {
    const ratio = maxHeight / height;
    height = maxHeight;
    width = Math.round(width * ratio);
  }

  return { width, height };
}

function getEffectiveDimensions(dimensions: Dimensions, opts: { crop?: SanityImageCrop | null } = {}) {
  const { crop } = opts;
  const { width: intrinsicWidth, height: intrinsicHeight } = dimensions;

  if (!intrinsicWidth || !intrinsicHeight) {
    return { width: undefined, height: undefined };
  }

  if (!crop) {
    return { width: intrinsicWidth, height: intrinsicHeight };
  }

  const { left = 0, top = 0, right = 0, bottom = 0 } = crop;
  const cropWidth = intrinsicWidth - left * intrinsicWidth - right * intrinsicWidth;
  const cropHeight = intrinsicHeight - top * intrinsicHeight - bottom * intrinsicHeight;

  return {
    width: cropWidth > 0 ? cropWidth : intrinsicWidth,
    height: cropHeight > 0 ? cropHeight : intrinsicHeight,
  };
}

function getImageAspectRatio(image: ImageFragmentResult, opts: { crop?: SanityImageCrop | null } = {}) {
  if (!image.dimensions) {
    throw new Error("Dimensions are missing");
  }

  const { width, height } = getEffectiveDimensions(image.dimensions, opts);
  return width && height ? width / height : undefined;
}

function calculateImageDimensions(
  image: ImageFragmentResult,
  opts: { width?: number; height?: number; aspectRatio?: number; crop?: SanityImageCrop | null } = {}
) {
  const { crop, aspectRatio, height, width } = opts;

  const imageAR = getImageAspectRatio(image, { crop });
  const effectiveAR = aspectRatio ?? imageAR;

  // Ensure that we are not up scaling a small image.
  const upperBound = image.dimensions?.width ?? Number.POSITIVE_INFINITY;
  const widestSource = DEFAULT_SOURCE_WIDTHS[DEFAULT_SOURCE_WIDTHS.length - 1] as number;
  const maxWidth = Math.min(widestSource, upperBound);

  return calculateDimensions({ width, height }, effectiveAR, {
    width: maxWidth,
  });
}

export function getLqipBackgroundStyle({ lqip }: ImageFragmentResult) {
  if (!lqip) {
    return null;
  }

  return {
    backgroundImage: `url(${lqip})`,
    backgroundSize: "cover",
  } as const satisfies React.CSSProperties;
}

export function getImageDimensions(image: ImageFragmentResult, options: BuilderOptions = {}) {
  const { width, height, aspectRatio, maxWidth, maxHeight } = options;

  const rawDimensions = calculateImageDimensions(image, {
    width,
    height,
    aspectRatio,
    crop: image.crop,
  });

  return applyMaxConstraints(rawDimensions, {
    maxWidth,
    maxHeight,
  });
}

export function getImageSrc(image: ImageFragmentResult, options: BuilderOptions = {}) {
  // A local file has no CDN to transform it, so it is served exactly as it sits in `public/`.
  if (image.url) {
    return image.url;
  }

  const { width, height, aspectRatio, ...builderOptions } = options;

  const fit = run(() => {
    if (image?.crop) {
      return "crop";
    }

    if (options.fit) {
      return options.fit;
    }

    if ((width && height) || aspectRatio) {
      return "crop";
    }

    return undefined;
  });

  const imageDimensions = getImageDimensions(image, {
    width,
    height,
    aspectRatio,
  });

  return buildImageUrl(image, {
    ...builderOptions,
    fit,
    width: imageDimensions.width,
    height: imageDimensions.height,
  });
}

export function getImageSrcSet(image: ImageFragmentResult, options: BuilderOptions = {}) {
  if (image.url) {
    return "";
  }

  const { sourceWidths = DEFAULT_SOURCE_WIDTHS, ...builderOptions } = options;
  const nativeWidth = image.dimensions?.width;

  const entries = run(() => {
    // A fixed size, or an original narrower than the smallest source, needs no srcSet beyond a retina version.
    if (builderOptions.width || builderOptions.height || (nativeWidth && nativeWidth < (sourceWidths[0] as number))) {
      return [2, 3].map((dpr) => {
        const imgUrl = getImageSrc(image, { ...builderOptions, dpr });
        return `${imgUrl} ${dpr}x`;
      });
    }

    return sourceWidths.map((sourceW) => {
      // Never upscale an image.
      if (nativeWidth && nativeWidth < sourceW) {
        return null;
      }

      // Override any custom height: only the width matters for a srcSet entry.
      const imgUrl = getImageSrc(image, { ...builderOptions, height: undefined, width: sourceW });
      return `${imgUrl} ${sourceW}w`;
    });
  });

  return entries.filter(Boolean).join(", ");
}

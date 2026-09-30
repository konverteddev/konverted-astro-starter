import { defineField, type ObjectComponents, type ObjectOptions, type Rule } from "sanity";
import { LottieFileInput, RiveFileInput } from "../../inputs/asset-dimensions-input";
import { ClearableObjectInput } from "../../inputs/clearable-object-input";
import { VideoPosterInput } from "../../inputs/video-poster-input";
import { composeValidation, requiredIf, requireTypeWhenObjectHasValue, selectByName, visibleIf } from "../../utils";

const visibleIfType = visibleIf("type");
const requiredIfType = requiredIf("type");

type MediaType = "image" | "videoMux" | "videoFile" | "videoUrl" | "rive" | "lottie";

const MEDIA_TYPE_OPTIONS: { title: string; value: MediaType }[] = [
  { title: "🖼️ Image", value: "image" },
  { title: "🎥 Mux Video", value: "videoMux" },
  { title: "🎬 Video file", value: "videoFile" },
  { title: "🔗 Video URL", value: "videoUrl" },
  { title: "🕹️ Rive", value: "rive" },
  { title: "✨ Lottie", value: "lottie" },
];

function buildPosterUrl(playbackId: string, time = 1) {
  return `https://image.mux.com/${playbackId}/thumbnail.webp?width=80&height=80&time=${time}&fit_mode=smartcrop`;
}

/** The cover as a Studio preview thumbnail; every video kind now has one to show. */
const coverThumb = (url: string) => () => <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />;

/** Preview `select` map for a media object; pass the field name when the media lives on a sibling field. */
function mediaPreviewSelect(fieldName = "") {
  const prefix = fieldName ? `${fieldName}.` : "";

  return {
    type: `${prefix}type`,
    image: `${prefix}image`,
    playbackId: `${prefix}video.asset.playbackId`,
    thumbTime: `${prefix}video.asset.thumbTime`,
    videoCoverUrl: `${prefix}videoCover.asset.url`,
  };
}

function buildMediaPreview({
  type,
  image,
  playbackId,
  thumbTime = 1,
  videoCoverUrl,
}: {
  type?: string;
  image?: string;
  playbackId?: string;
  thumbTime?: string | number;
  videoCoverUrl?: string;
}) {
  switch (type) {
    case "videoMux": {
      const posterUrl = videoCoverUrl ?? (playbackId ? buildPosterUrl(playbackId, Number(thumbTime)) : null);

      return {
        title: "Mux Video",
        media: posterUrl ? coverThumb(posterUrl) : () => <>🎥</>,
      };
    }
    case "videoFile":
      return {
        title: "Video file",
        media: videoCoverUrl ? coverThumb(videoCoverUrl) : () => <>🎬</>,
      };
    case "videoUrl":
      return {
        title: "Video URL",
        media: videoCoverUrl ? coverThumb(videoCoverUrl) : () => <>🔗</>,
      };
    case "image":
      return {
        title: "Image",
        media: image ?? (() => <>🖼️</>),
      };
    case "lottie": {
      return {
        title: "Lottie",
        media: () => <>✨</>,
      };
    }
    case "rive": {
      return {
        title: "Rive",
        media: () => <>🕹️</>,
      };
    }
    default:
      return {
        title: "Media",
        media: () => <>🖼️</>,
      };
  }
}

function createMediaField({
  group,
  options,
  components,
  withCustomRatio,
  withCustomVideoOptions,
  withCustomRiveOptions,
  withCustomLottieOptions,
  whitelist,
  blacklist,
  icon = () => <>🖼️</>,
  name = "appMedia",
  title = "Media",
  description = "Upload or embed video or image content.",
  hidden,
  validation: externalValidation,
}: {
  name?: string;
  title?: string;
  group?: string;
  options?: ObjectOptions;
  description?: string;
  components?: ObjectComponents;
  withCustomRatio?: boolean;
  withCustomVideoOptions?: boolean;
  withCustomRiveOptions?: boolean;
  withCustomLottieOptions?: boolean;
  whitelist?: MediaType[];
  blacklist?: MediaType[];
  icon?: React.ComponentType | React.ReactNode;
  hidden?: (props: { parent: { [key: string]: unknown } }) => boolean;
  validation?: (R: Rule) => unknown;
} = {}) {
  const enabledTypeOptions = selectByName(MEDIA_TYPE_OPTIONS, (option) => option.value, {
    whitelist,
    blacklist,
    label: "createMediaField",
  });

  return defineField({
    type: "object",
    name,
    title,
    description,
    group,
    icon,
    hidden,
    validation: externalValidation
      ? (R) => composeValidation(requireTypeWhenObjectHasValue("Select a media type.", hidden), externalValidation)(R as Rule)
      : undefined,
    components: {
      input: (props) => <ClearableObjectInput {...props} />,
      ...components,
    },
    options: {
      collapsed: false,
      collapsible: true,
      ...options,
    },
    fields: [
      defineField({
        name: "type",
        type: "string",
        title: "Media Type",
        options: {
          layout: "radio",
          direction: "horizontal",
          list: enabledTypeOptions,
        },
      }),
      defineField({
        name: "videoFile",
        type: "file",
        title: "Video file",
        description:
          "Upload a self-hosted video file (MP4, WebM). Ships inside the dataset export, so it travels with your content.",
        options: {
          accept: "video/*",
          collapsed: false,
          collapsible: false,
        },
        components: {
          input: VideoPosterInput,
        },
        ...visibleIfType("videoFile"),
        ...requiredIfType("videoFile"),
      }),
      defineField({
        name: "videoUrl",
        type: "url",
        title: "Video URL",
        description:
          "Paste a direct link to a video file (e.g. an .mp4 or .webm URL). Hosted elsewhere, so nothing is added to your dataset export.",
        ...visibleIfType("videoUrl"),
        validation: (R) =>
          R.uri({ scheme: ["http", "https"] }).custom((val, { parent }) => {
            const selectedType = (parent as { type?: string } | undefined)?.type;

            if (selectedType !== "videoUrl") {
              return true;
            }

            return val ? true : "Paste a video URL.";
          }),
      }),
      defineField({
        name: "image",
        type: "image",
        title: "Image",
        description: "Select or upload an image.",
        ...visibleIfType("image"),
        ...requiredIfType("image"),
        options: {
          hotspot: true,
          collapsed: false,
          collapsible: false,
          accept: "image/*",
        },
      }),
      defineField({
        name: "video",
        type: "mux.video",
        options: {
          collapsed: false,
          collapsible: false,
        },
        ...visibleIfType("videoMux"),
        ...requiredIfType("videoMux"),
      }),
      defineField({
        name: "videoCover",
        type: "image",
        title: "Video cover",
        options: {
          hotspot: true,
          collapsed: false,
          collapsible: false,
          accept: "image/*",
        },
        ...visibleIfType(["videoMux", "videoFile", "videoUrl"]),
        ...requiredIfType(["videoFile", "videoUrl"]),
      }),
      defineField({
        name: "animatedThumbnail",
        type: "object",
        title: "Animated thumbnail",
        description:
          "Show a short looping clip (animated.webp) as the poster instead of a static frame. Ignored if Custom video cover is set.",
        options: {
          collapsed: true,
          collapsible: true,
        },
        ...visibleIfType("videoMux"),
        fields: [
          defineField({
            name: "enabled",
            type: "boolean",
            title: "Enable",
            initialValue: false,
          }),
          defineField({
            name: "start",
            type: "number",
            title: "Start (seconds)",
            initialValue: 0,
            validation: (R) => R.min(0),
          }),
          defineField({
            name: "end",
            type: "number",
            title: "End (seconds)",
            description: "Clip length (end minus start) must be between 0.25s and 10s.",
            initialValue: 3,
            validation: (R) => R.min(0.25),
          }),
        ],
        validation: (R) =>
          R.custom((value) => {
            const v = value as { enabled?: boolean; start?: number; end?: number } | undefined;

            if (!v?.enabled) {
              return true;
            }

            const start = v.start ?? 0;
            const end = v.end ?? 0;

            if (end <= start) {
              return "End must be greater than start.";
            }

            const duration = end - start;

            if (duration < 0.25) {
              return "Clip must be at least 0.25s.";
            }

            if (duration > 10) {
              return "Clip cannot exceed 10s (Mux limit).";
            }

            return true;
          }),
      }),
      ...(withCustomVideoOptions
        ? [
            defineField({
              name: "videoOptions",
              type: "videoOptions",
              options: {
                collapsed: false,
                collapsible: false,
              },
              ...visibleIfType(["videoMux", "videoFile", "videoUrl"]),
            }),
          ]
        : []),
      defineField({
        name: "riveFile",
        type: "file",
        title: "Rive file",
        description: "Upload a Rive animation file (.riv).",
        options: {
          accept: ".riv",
          collapsed: false,
          collapsible: false,
        },
        components: {
          input: RiveFileInput,
        },
        validation: (R) =>
          R.custom((val, { parent }) => {
            const t = (parent as { type?: string } | undefined)?.type;

            if (t !== "rive") {
              return true;
            }

            const hasRef = Boolean(
              val && typeof val === "object" && "asset" in val && (val as { asset?: { _ref?: string } }).asset?._ref
            );

            return hasRef ? true : "Upload a Rive file (.riv).";
          }),
        ...visibleIfType("rive"),
      }),
      defineField({
        name: "riveDimensions",
        type: "object",
        title: "Detected dimensions",
        description: "Use Generate to detect from file, then tweak manually if needed.",
        options: { collapsed: false, collapsible: true, columns: 2 },
        validation: (R) =>
          R.custom((val, { parent }) => {
            const selectedType = (parent as { type?: string } | undefined)?.type;

            if (selectedType !== "rive") {
              return true;
            }

            const width = val && typeof val === "object" && "width" in val ? (val as { width?: unknown }).width : undefined;
            const height = val && typeof val === "object" && "height" in val ? (val as { height?: unknown }).height : undefined;
            const hasWidth = typeof width === "number" && width > 0;
            const hasHeight = typeof height === "number" && height > 0;

            return hasWidth && hasHeight ? true : "Generate Rive dimensions or set width and height manually.";
          }),
        ...visibleIfType("rive"),
        fields: [
          defineField({
            name: "width",
            type: "number",
          }),
          defineField({
            name: "height",
            type: "number",
          }),
        ],
      }),
      ...(withCustomRiveOptions
        ? [
            defineField({
              name: "riveOptions",
              type: "riveOptions",
              options: {
                collapsed: false,
                collapsible: false,
              },
              ...visibleIfType("rive"),
            }),
          ]
        : []),
      defineField({
        name: "lottieFile",
        type: "file",
        title: "Lottie file",
        description: "Upload a Bodymovin JSON (.json) or dotLottie (.lottie) file.",
        options: {
          accept: "application/json,.json,.lottie,application/zip,application/x-dotlottie,application/octet-stream",
          collapsed: false,
          collapsible: false,
        },
        components: {
          input: LottieFileInput,
        },
        validation: (R) =>
          R.custom((val, { parent }) => {
            const t = (parent as { type?: string } | undefined)?.type;

            if (t !== "lottie") {
              return true;
            }

            const hasRef = Boolean(
              val && typeof val === "object" && "asset" in val && (val as { asset?: { _ref?: string } }).asset?._ref
            );

            return hasRef ? true : "Upload a Lottie file (.json or .lottie).";
          }),
        ...visibleIfType("lottie"),
      }),
      defineField({
        name: "lottieDimensions",
        type: "object",
        title: "Detected dimensions",
        description: "Use Generate to detect from file, then tweak manually if needed.",
        options: { collapsed: false, collapsible: true, columns: 2 },
        validation: (R) =>
          R.custom((val, { parent }) => {
            const selectedType = (parent as { type?: string } | undefined)?.type;

            if (selectedType !== "lottie") {
              return true;
            }

            const width = val && typeof val === "object" && "width" in val ? (val as { width?: unknown }).width : undefined;
            const height = val && typeof val === "object" && "height" in val ? (val as { height?: unknown }).height : undefined;
            const hasWidth = typeof width === "number" && width > 0;
            const hasHeight = typeof height === "number" && height > 0;

            return hasWidth && hasHeight ? true : "Generate Lottie dimensions or set width and height manually.";
          }),
        ...visibleIfType("lottie"),
        fields: [
          defineField({
            name: "width",
            type: "number",
          }),
          defineField({
            name: "height",
            type: "number",
          }),
        ],
      }),
      ...(withCustomLottieOptions
        ? [
            defineField({
              name: "lottieOptions",
              type: "lottieOptions",
              options: {
                collapsed: false,
                collapsible: false,
              },
              ...visibleIfType("lottie"),
            }),
          ]
        : []),
      ...(withCustomRatio
        ? [
            defineField({
              name: "aspectRatio",
              type: "aspectRatio",
            }),
          ]
        : []),
    ],
    preview: {
      select: mediaPreviewSelect(),
      prepare: (props) => {
        return buildMediaPreview(props);
      },
    },
  });
}

export { buildMediaPreview, createMediaField, mediaPreviewSelect };

import { ImageIcon } from "@sanity/icons/Image";
import { defineArrayMember, defineField } from "sanity";
import { buildMediaPreview, createMediaField, mediaPreviewSelect } from "../../create-media";

export const mediaBlock = defineArrayMember({
  name: "mediaBlock",
  type: "object",
  title: "Media Block",
  description: "Embed block video or image content.",
  icon: ImageIcon,
  fields: [
    createMediaField({
      validation: (R) => R.required(),
      withCustomRatio: true,
      withCustomVideoOptions: true,
      withCustomRiveOptions: true,
      options: {
        collapsed: false,
        collapsible: false,
      },
    }),
    defineField({
      name: "useParallax",
      type: "boolean",
      title: "Use Parallax",
      initialValue: false,
      description: "Apply a scroll-driven parallax effect to the media.",
    }),
    defineField({
      name: "caption",
      type: "text",
      rows: 2,
      description: "Add a caption for the media.",
    }),
  ],
  preview: {
    select: mediaPreviewSelect("appMedia"),
    prepare: (props) => {
      return buildMediaPreview(props);
    },
  },
});

import { defineField } from "sanity";

export const videoOptions = defineField({
  name: "videoOptions",
  type: "object",
  title: "Video Options",
  description: "Configure video playback options.",
  icon: () => <>🎚️</>,
  options: {
    collapsed: false,
    collapsible: true,
  },
  fields: [
    defineField({
      name: "controls",
      type: "boolean",
      title: "Controls",
      initialValue: true,
      description: "Include control buttons.",
    }),
    defineField({
      name: "loop",
      type: "boolean",
      title: "Loop",
      initialValue: false,
      description: "Play on infinite loop.",
    }),
    defineField({
      name: "muted",
      type: "boolean",
      title: "Muted",
      initialValue: false,
      description: "Start muted.",
    }),
    defineField({
      name: "autoPlay",
      type: "boolean",
      title: "Auto Play",
      initialValue: false,
      description: "Start automatically. Requires muted to be true.",
    }),
  ],
});

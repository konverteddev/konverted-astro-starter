import { defineField } from "sanity";

export const lottieOptions = defineField({
  name: "lottieOptions",
  type: "object",
  title: "Lottie Options",
  description: "Configure Lottie playback.",
  icon: () => <>🎚️</>,
  options: {
    collapsed: false,
    collapsible: true,
  },
  fields: [
    defineField({
      name: "loop",
      type: "boolean",
      title: "Loop",
      description: "Play on a loop.",
    }),
    defineField({
      name: "autoPlay",
      type: "boolean",
      title: "Auto Play",
      description: "Start automatically when in view.",
    }),
  ],
});

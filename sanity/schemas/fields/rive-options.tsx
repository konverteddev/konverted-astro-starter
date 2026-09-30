import { defineField } from "sanity";

export const riveOptions = defineField({
  name: "riveOptions",
  type: "object",
  title: "Rive Options",
  description: "Configure Rive playback.",
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
    defineField({
      name: "stateMachine",
      type: "string",
      title: "State Machine",
      description: "Name of the state machine to play. Leave empty to use the file's default.",
    }),
    defineField({
      name: "autoBind",
      type: "boolean",
      title: "Data Binding",
      description:
        "Bind the file's default view model. Turn on only for .riv files that use data binding / a view model to drive the animation.",
    }),
  ],
});

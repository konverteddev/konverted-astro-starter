import { defineField } from "sanity";

export const aspectRatio = defineField({
  name: "aspectRatio",
  type: "number",
  title: "Aspect Ratio",
  initialValue: 0,
  options: {
    layout: "radio",
    direction: "horizontal",
    list: [
      // Using `0` as a value allows as to treat it as falsy in the FE.
      { title: "Natural", value: 0 },
      { title: "1:1", value: 1 },
      { title: "16:9", value: 16 / 9 },
      { title: "4:3", value: 4 / 3 },
      { title: "7:5", value: 7 / 5 },
      { title: "5:7", value: 5 / 7 },
    ],
  },
});

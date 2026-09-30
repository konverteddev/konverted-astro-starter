import type { ComponentProps } from "astro/types";
import { definePreview } from "~/features/page-builder/section-preview";
import { sampleRichText } from "~/features/page-builder/section-preview-samples";
import type Text from "./Text.astro";

export const preview = definePreview<ComponentProps<typeof Text>>({
  props: {
    headline: "Lorem ipsum dolor sit amet",
    text: [
      ...sampleRichText(
        "text-one",
        "Lorem ipsum dolor sit amet consectetur. At congue vitae leo et gravida scelerisque at. Dapibus lectus aliquam neque diam diam lectus facilisis. Cursus nec suscipit arcu aliquet."
      ),
      ...sampleRichText(
        "text-two",
        "Pharetra euismod tellus aliquam consequat egestas aenean dui mauris eu non. Netus adipiscing cras nec tincidunt vitae turpis praesent diam gravida."
      ),
    ],
  },
});

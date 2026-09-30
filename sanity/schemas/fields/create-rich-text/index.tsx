import { ColorWheelIcon } from "@sanity/icons/ColorWheel";
import { DoubleChevronRightIcon } from "@sanity/icons/DoubleChevronRight";
import { HighlightIcon } from "@sanity/icons/Highlight";
import { ImageIcon } from "@sanity/icons/Image";
import { LinkIcon } from "@sanity/icons/Link";
import { NumberIcon } from "@sanity/icons/Number";
import * as React from "react";
import { type ArrayRule, defineArrayMember, defineField, type ValidationBuilder } from "sanity";
import { findBrandColor } from "../../../colors";
import { selectByName } from "../../../utils";
import { createLinkField } from "../create-link";
import { buildMediaPreview, createMediaField, mediaPreviewSelect } from "../create-media";
import { blocks } from "./blocks";

const linkField = createLinkField({
  name: "linkField",
  title: "Link",
  icon: LinkIcon,
  noCustomText: true,
});

const heading2Style = {
  title: "Heading 2",
  value: "h2",
  component: (props: { children?: React.ReactNode }) => <span style={{ fontSize: "145%" }}>{props.children}</span>,
} as const;

const heading3Style = {
  title: "Heading 3",
  value: "h3",
  component: (props: { children?: React.ReactNode }) => <span style={{ fontSize: "130%" }}>{props.children}</span>,
} as const;

const heading4Style = {
  title: "Heading 4",
  value: "h4",
  component: (props: { children?: React.ReactNode }) => <span style={{ fontSize: "115%" }}>{props.children}</span>,
} as const;

const captionStyle = {
  title: "Caption",
  value: "caption",
  component: (props: { children?: React.ReactNode }) => (
    <span style={{ fontSize: "85%", fontFamily: "ui-monospace, monospace" }}>{props.children}</span>
  ),
} as const;

type StylableElement = React.ReactElement<{ style?: React.CSSProperties }>;

const textColorField = defineField({
  type: "object",
  name: "textColorField",
  title: "Text Color",
  icon: ColorWheelIcon,
  fields: [{ name: "color", type: "appColor" }],
  components: {
    annotation: (props) => {
      const color = findBrandColor(props.value?.color as string | undefined)?.swatch;
      const defaultNode = props.renderDefault(props);

      if (!React.isValidElement(defaultNode)) {
        return defaultNode;
      }
      const element = defaultNode as StylableElement;

      return React.cloneElement(element, {
        // Inline style on the annotation root wins over internal class colors.
        style: {
          ...(element.props.style ?? {}),
          color,
          backgroundColor: "transparent",
          borderBottom: "none",
        },
      });
    },
  },
});

const highlightColorField = defineField({
  type: "object",
  name: "highlightColorField",
  title: "Highlight Color",
  icon: HighlightIcon,
  fields: [{ name: "color", type: "appColor" }],
  components: {
    annotation: (props) => {
      const color = findBrandColor(props.value?.color as string | undefined)?.swatch;
      const defaultNode = props.renderDefault(props);

      if (!React.isValidElement(defaultNode)) {
        return defaultNode;
      }
      const element = defaultNode as StylableElement;

      return React.cloneElement(element, {
        // Apply highlight on the annotation root to avoid nested style overrides.
        style: {
          ...(element.props.style ?? {}),
          backgroundColor: color,
          color: "inherit",
          borderBottom: "none",
        },
      });
    },
  },
});

const indentField = defineField({
  type: "object",
  name: "indentField",
  title: "Line Indent",
  icon: DoubleChevronRightIcon,
  fields: [
    {
      name: "widthPercent",
      type: "number",
      title: "Width (%)",
      description: "Line indent as a percentage of the block's width.",
      validation: (R) => R.required().min(0).max(100),
    },
  ],
  components: {
    annotation: (props) => {
      const widthPercent = props.value?.widthPercent as number | undefined;
      const defaultNode = props.renderDefault(props);

      if (!React.isValidElement(defaultNode) || typeof widthPercent !== "number") {
        return defaultNode;
      }
      const element = defaultNode as StylableElement;

      return React.cloneElement(element, {
        style: {
          ...(element.props.style ?? {}),
          paddingLeft: `${widthPercent}%`,
        },
      });
    },
  },
});

const inlineMediaField = defineArrayMember({
  name: "inlineMediaField",
  type: "object",
  title: "Inline Media",
  description: "Embed inline video or image content.",
  icon: ImageIcon,
  fields: [
    createMediaField({
      name: "media",
      validation: (R) => R.required(),
      withCustomRiveOptions: true,
      options: {
        collapsed: false,
        collapsible: false,
      },
    }),
  ],
  components: {
    preview: (props) => {
      return props.renderDefault(props);
    },
  },
  preview: {
    select: mediaPreviewSelect("media"),
    prepare: (props) => {
      return buildMediaPreview(props);
    },
  },
});

type BlockName = NonNullable<(typeof blocks)[number]["name"]>;

export function createRichTextField({
  group,
  validation,
  description,
  whitelist,
  blacklist,
  variant = "simple",
  name = "appRichText",
  title = "Rich Text",
}: {
  name?: string;
  title?: string;
  group?: string;
  description?: string;
  validation?: ValidationBuilder<ArrayRule<unknown[]>, unknown[]>;
  whitelist?: BlockName[];
  blacklist?: BlockName[];
  variant?: "simple" | "full";
}) {
  const enabledBlocks = selectByName(blocks, (schema) => schema.name, {
    whitelist,
    blacklist,
    label: "createRichTextField",
  });

  return defineField({
    type: "array",
    name,
    title,
    group,
    description,
    validation,
    components: {
      // biome-ignore lint/suspicious/noExplicitAny: Sanity doesn't provide these types.
      field: (props: any) => {
        return (
          <div style={{ "--pt-editor-height": variant === "simple" ? "10rem" : "50vh" } as React.CSSProperties}>
            {props.renderDefault({ ...props, initialActive: true })}
          </div>
        );
      },
    },
    of: [
      ...(variant === "simple" ? [] : enabledBlocks),
      defineArrayMember({
        type: "block",
        options: {
          spellCheck: variant !== "simple",
          unstable_whitespaceOnPasteMode: "normalize",
        },
        of: variant === "simple" ? [] : [inlineMediaField],
        styles:
          variant === "simple"
            ? [{ title: "Normal", value: "normal" }, captionStyle]
            : [{ title: "Normal", value: "normal" }, heading2Style, heading3Style, heading4Style, captionStyle],
        lists:
          variant === "simple"
            ? []
            : [
                { title: "Bullet", value: "bullet" },
                { title: "Number", value: "number" },
              ],
        marks: {
          annotations: [linkField, textColorField, highlightColorField, indentField],
          decorators:
            variant === "simple"
              ? [
                  { title: "Strong", value: "strong" },
                  { title: "Emphasis", value: "em" },
                  { title: "Code", value: "code" },
                ]
              : [
                  { title: "Strong", value: "strong" },
                  { title: "Emphasis", value: "em" },
                  { title: "Code", value: "code" },
                  {
                    title: "Sup",
                    value: "sup",
                    icon: NumberIcon,
                    component: (props) => <sup style={{ verticalAlign: "super" }}>{props.children}</sup>,
                  },
                ],
        },
      }),
    ],
  });
}

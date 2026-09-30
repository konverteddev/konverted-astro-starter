import * as changeCase from "change-case";
import type { ArrayOfObjectsInputProps, ArrayRule, ObjectItemProps, ObjectOptions, PathSegment, ValidationBuilder } from "sanity";
import { defineArrayMember, defineField } from "sanity";
import { composeValidation, selectByName } from "../../utils";
import { sections } from "../page-sections";

type SectionName = (typeof sections)[number]["name"];

function wrapSectionName(name: SectionName) {
  return `${name}Field`;
}

function unwrapSectionName(name: string) {
  return name.replace("Field", "") as SectionName;
}

function mapPreviewSelect(select: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(select).map(([key, path]) => {
      return [key, `sectionContent.${path}`];
    })
  );
}

function isSectionSegment(path?: PathSegment): path is { _key: string } {
  return Boolean(typeof path === "object" && "_key" in path);
}

function getCountsByType(value: unknown[] | undefined): Record<string, number> {
  const counts: Record<string, number> = {};

  if (!Array.isArray(value)) {
    return counts;
  }

  for (const item of value) {
    const type = (item as { _type?: string })?._type;

    if (type) {
      counts[type] = (counts[type] ?? 0) + 1;
    }
  }

  return counts;
}

export function PageBuilderSectionsArrayInput(props: ArrayOfObjectsInputProps) {
  const fieldOptions = props.schemaType?.options as { sectionMaxCount?: Record<string, number> } | undefined;
  const sectionMaxCount = fieldOptions?.sectionMaxCount;

  if (!sectionMaxCount || Object.keys(sectionMaxCount).length === 0) {
    return props.renderDefault(props);
  }

  const baseSchemaType = props.schemaType;

  if (!baseSchemaType || !Array.isArray(baseSchemaType.of)) {
    return props.renderDefault(props);
  }

  const counts = getCountsByType(props.value as unknown[]);
  const ofTypes = baseSchemaType.of;

  const availableTypes = ofTypes.filter((memberType) => {
    const typeName = (memberType as { name?: string })?.name;

    if (!typeName) {
      return true;
    }

    const sectionName = unwrapSectionName(typeName);
    const max = sectionMaxCount[sectionName];

    if (max === undefined) {
      return true;
    }

    // Counts are keyed by the array item's _type, which equals typeName.
    const count = counts[typeName] ?? 0;
    return count < max;
  });

  // An empty `of` crashes the Studio, so fall back to the full list; `sectionsArrayValidation` still blocks saving over the limit.
  const of = availableTypes.length > 0 ? availableTypes : ofTypes;

  const canInsertSection = availableTypes.length > 0;
  const baseOptions = (baseSchemaType.options ?? {}) as {
    disableActions?: string[];
    sectionMaxCount?: Record<string, number>;
    insertMenu?: unknown;
    [key: string]: unknown;
  };

  const mergedOptions = {
    ...baseOptions,
    ...(canInsertSection
      ? {}
      : {
          disableActions: Array.from(new Set([...(baseOptions.disableActions ?? []), "add"])),
        }),
  };

  return props.renderDefault({
    ...props,
    schemaType: {
      ...baseSchemaType,
      of,
      options: mergedOptions as (typeof baseSchemaType)["options"],
    },
  });
}

function isSectionDisabled(value: unknown): boolean {
  return Boolean((value as { sectionSettings?: { disabled?: boolean } } | undefined)?.sectionSettings?.disabled);
}

// The wrapper stays mounted in both states: swapping the tree shape would remount the item and close its open dialog.
export function PageBuilderSectionItem(props: ObjectItemProps) {
  return <div style={{ opacity: isSectionDisabled(props.value) ? 0.4 : undefined }}>{props.renderDefault(props)}</div>;
}

// In `sectionSettings` so one addition reaches every section; a switch only one section could use belongs in its own schema.
const sectionLayoutFields = [
  defineField({
    type: "boolean",
    name: "fullBleed",
    title: "Full Bleed",
    initialValue: false,
    description: "Run this section to both viewport edges instead of capping it to the page column. The page margin stays.",
  }),
];

const sectionSettings = defineField({
  type: "object",
  group: "settings",
  name: "sectionSettings",
  fields: [
    defineField({
      type: "boolean",
      name: "disabled",
      title: "Disabled",
      description: "Hide this section on the website without deleting it. Toggle off to publish it again.",
      initialValue: false,
    }),
    defineField({
      type: "string",
      name: "sectionTitle",
      description: "Used internally to identify the section.",
    }),
    defineField({
      type: "slug",
      name: "sectionHash",
      title: "Section Hash",
      description: "Used to link to this section.",
      options: {
        isUnique: (input, { document, path }) => {
          // @ts-expect-error Its our page builder field.
          const array = document?.pageBuilder?.sectionsArray;

          if (!array?.length) {
            return true;
          }

          const activeItem = path?.find(isSectionSegment);

          const otherHashes: string[] = array
            .filter((el: { _key: string }) => !activeItem || activeItem._key !== el._key)
            // biome-ignore lint/suspicious/noExplicitAny: its our page builder.
            .map((el: any) => el.sectionSettings?.sectionHash?.current)
            .filter(Boolean);

          return !otherHashes.some((el) => input === el);
        },
        source: (_, { parent, parentPath }) => {
          const key = parentPath?.find(isSectionSegment)?._key ?? "";
          // @ts-expect-error The link field refers to the parent and exists.
          const sectionHash = parent?.sectionTitle ? changeCase.kebabCase(parent.sectionTitle) : key;
          return sectionHash;
        },
      },
    }),
    ...sectionLayoutFields,
  ],
});

// Wrap each section as an array member: generic section settings + the section's own content.
const sectionFields = sections.map((section) => {
  const sectionTitle = changeCase.capitalCase(section.name.replace("Section", ""));
  const sectionSelect = (section.preview as { select?: Record<string, string> } | undefined)?.select ?? {};

  return defineArrayMember({
    type: "object",
    name: wrapSectionName(section.name),
    title: sectionTitle,
    icon: section.icon,
    groups: [
      { name: "default", title: "Content", icon: () => <>📄</>, default: true },
      { name: "settings", title: "Settings", icon: () => <>⚙</> },
    ],
    components: {
      item: PageBuilderSectionItem,
    },
    fields: [
      sectionSettings,
      defineField({
        type: section.name as string,
        group: "default",
        name: "sectionContent",
      }),
    ],
    preview: {
      select: {
        sectionTitle: "sectionSettings.sectionTitle",
        sectionDisabled: "sectionSettings.disabled",
        ...mapPreviewSelect(sectionSelect),
      },
      prepare: (selection) => {
        const {
          sectionTitle: customTitle,
          sectionDisabled,
          ...sectionSelection
        } = selection as {
          sectionTitle?: string;
          sectionDisabled?: boolean;
          [key: string]: unknown;
        };

        const withDisabledHint = (subtitle: string) => (sectionDisabled ? `Disabled · ${subtitle}` : subtitle);

        // biome-ignore lint/suspicious/noExplicitAny: its our page builder.
        const sectionPreview = section.preview as any;

        if (sectionPreview?.prepare) {
          const preparedPreview = sectionPreview.prepare(sectionSelection);

          return {
            title: customTitle ?? preparedPreview.title ?? sectionTitle,
            subtitle: withDisabledHint(preparedPreview.subtitle ?? sectionTitle),
            media: preparedPreview.media ?? section.icon,
          };
        }

        return {
          title: customTitle ?? sectionTitle,
          subtitle: withDisabledHint(sectionTitle),
          media: section.icon,
        };
      },
    },
  });
});

export function createPageBuilderField({
  group,
  options,
  whitelist,
  blacklist,
  sectionMaxCount,
  validation,
  name = "pageBuilder",
  title = "Page Builder",
  description = "Drag & drop sections to build your page.",
  thumbnailBaseUrl = "/page-builder-section-thumbs",
}: {
  name?: string;
  title?: string;
  group?: string;
  description?: string;
  options?: ObjectOptions;
  whitelist?: SectionName[];
  blacklist?: SectionName[];
  /** Max number of times each section can be used in this page builder. E.g. { mediaSectionField: 1 }. */
  sectionMaxCount?: Partial<Record<SectionName, number>>;
  /** Not under the Studio base path: that prefix is routed to the Studio before `public/` files. */
  thumbnailBaseUrl?: string;
  validation?: ValidationBuilder<ArrayRule<unknown[]>, unknown[]>;
} = {}) {
  const enabledSections = selectByName(sectionFields, (schema) => (schema.name ? unwrapSectionName(schema.name) : undefined), {
    whitelist,
    blacklist,
    label: "createPageBuilderField",
  });

  const sectionLimits = sectionMaxCount && Object.keys(sectionMaxCount).length > 0 ? sectionMaxCount : null;

  const sectionsArrayValidation: ValidationBuilder<ArrayRule<unknown[]>, unknown[]> = (R) => {
    let rule = R.min(1);

    if (sectionLimits) {
      rule = rule.custom((arrayValue) => {
        if (!Array.isArray(arrayValue)) {
          return true;
        }

        const counts: Record<string, number> = {};

        for (const item of arrayValue) {
          const type = (item as { _type?: string })?._type;

          if (type) {
            counts[type] = (counts[type] ?? 0) + 1;
          }
        }

        for (const [sectionName, max] of Object.entries(sectionLimits)) {
          const fieldType = wrapSectionName(sectionName as SectionName);
          const count = counts[fieldType] ?? 0;

          if (count > max) {
            const label = changeCase.capitalCase(sectionName.replace("Section", ""));
            return `${label} can be used at most ${max} time(s). Currently used ${count} time(s).`;
          }
        }

        return true;
      });
    }

    // Non-blocking: editors can park every section, but the empty page should not go unnoticed.
    const allDisabledWarning = R.custom((arrayValue) => {
      if (!Array.isArray(arrayValue) || arrayValue.length === 0) {
        return true;
      }

      const hasEnabledSection = arrayValue.some((item) => !isSectionDisabled(item));
      return hasEnabledSection ? true : "Every section is disabled, so this page will render empty.";
    }).warning();

    const composed = composeValidation((rule: ArrayRule<unknown[]>) => rule, validation)(rule);
    return Array.isArray(composed) ? [...composed, allDisabledWarning] : [composed, allDisabledWarning];
  };

  return defineField({
    type: "object",
    name,
    title,
    group,
    description,
    options,
    fields: [
      defineField({
        name: "sectionsArray",
        type: "array",
        title: "Sections",
        validation: sectionsArrayValidation,
        of: enabledSections,
        ...(sectionLimits && { components: { input: PageBuilderSectionsArrayInput } }),
        options: {
          ...(sectionLimits && { sectionMaxCount: sectionLimits }),
          insertMenu: {
            filter: true,
            views: [
              {
                name: "grid",
                previewImageUrl: (name) => {
                  const sectionName = unwrapSectionName(name);
                  const sectionThumb = changeCase.kebabCase(sectionName);
                  return `${thumbnailBaseUrl}/${sectionThumb}.jpg`;
                },
              },
            ],
          },
        },
      }),
    ],
    preview: {
      prepare() {
        return {
          title: "Page Builder",
        };
      },
    },
  });
}

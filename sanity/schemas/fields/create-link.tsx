import { Box, Card, Flex, Text } from "@sanity/ui";
import * as changeCase from "change-case";
import * as React from "react";
import type { ObjectComponents, ObjectInputProps, ObjectOptions, Rule } from "sanity";
import { defineField, set, unset, useClient } from "sanity";
import { sanityConfig } from "../../config";
import { AsyncAutocomplete } from "../../inputs/async-autocomplete";
import { ClearableObjectInput } from "../../inputs/clearable-object-input";
import { composeValidation, requiredIf, requireTypeWhenObjectHasValue, visibleIf } from "../../utils";

const visibleIfType = visibleIf("type");
const requiredIfType = requiredIf("type");

function buildLinkPreview({
  type,
  customText,
  internalUri,
  internalTitle,
  externalUrl,
  email,
  phone,
  fileName,
  paramsHref,
}: {
  type?: string;
  customText?: string;
  internalUri?: string;
  internalTitle?: string;
  externalUrl?: string;
  email?: string;
  phone?: string;
  fileName?: string;
  paramsHref?: string;
}) {
  switch (type) {
    case "internal": {
      return {
        title: customText ?? internalTitle ?? "Internal Link",
        subtitle: internalUri,
        media: () => <>📄</>,
      };
    }
    case "external":
      return {
        title: customText ?? "External Link",
        subtitle: externalUrl,
        media: () => <>🌍</>,
      };
    case "email":
      return {
        title: customText ?? "Email Link",
        subtitle: email,
        media: () => <>📧</>,
      };
    case "phone":
      return {
        title: customText ?? "Phone Link",
        subtitle: phone,
        media: () => <>☎️</>,
      };
    case "file":
      return {
        title: customText ?? "File Link",
        subtitle: fileName,
        media: () => <>📃</>,
      };
    case "params":
      return {
        title: customText ?? "URL Params Link",
        subtitle: paramsHref,
        media: () => <>🎛️</>,
      };
    default:
      return {
        title: customText ?? "Empty Link",
        media: () => <>⛓️‍💥</>,
      };
  }
}

const InternalLinksQuery = `
  *[!(_id in path("drafts.**")) && defined(uri.current)]{
    "value": _id,
    "uri": uri.current,
    "label": coalesce(title, uri.current, _type),
  }
`;

function formatLabel(label: string) {
  return changeCase.capitalCase(label) || label;
}

const SectionsQuery = `
  *[_id == $pageId && defined(pageBuilder.sectionsArray)][0]{
    "sections": array::compact(pageBuilder.sectionsArray[]{
      "value": _key,
      "label": coalesce(sectionSettings.sectionTitle, _type),
    }),
  }.sections
`;

type InternalLinksQueryResult = {
  label: string;
  value: string;
  uri?: string;
}[];

type SectionQueryResult = {
  label?: string;
  value: string;
}[];

function InternalLinkInput({ value, onChange }: ObjectInputProps) {
  const client = useClient({ apiVersion: sanityConfig.apiVersion });

  const [items, setItems] = React.useState<InternalLinksQueryResult>([]);

  React.useEffect(() => {
    client
      .fetch<InternalLinksQueryResult>(InternalLinksQuery)
      .then((items) => items.sort((a, b) => a.label.localeCompare(b.label)))
      .then(setItems);
  }, [client]);

  React.useEffect(() => {
    if (!value?.link?._ref && value?.sectionTarget !== undefined) {
      onChange(unset(["sectionTarget"]));
    }
  }, [onChange, value?.link?._ref, value?.sectionTarget]);

  const fetchSections = React.useCallback(async () => {
    if (!value?.link?._ref) {
      return [];
    }

    try {
      const sections = await client.fetch<SectionQueryResult>(SectionsQuery, { pageId: value.link._ref });

      return sections;
    } catch {
      return [];
    }
  }, [client, value?.link?._ref]);

  return (
    <Flex direction="column" gap={2}>
      <AsyncAutocomplete
        placeholder="Select page"
        defaultValue={value?.link?._ref}
        listItems={items}
        onChange={(value) => {
          const next = value ? set({ _ref: value, _type: "reference", _weak: true }, ["link"]) : unset(["link"]);
          return onChange(next);
        }}
        renderValue={(value, opt) => {
          return opt?.label ? formatLabel(opt.label) : value;
        }}
        renderOption={({ label, uri }) => {
          return (
            <Card as="button">
              <Flex flex={1} padding={3} gap={2} direction="column">
                <Text size={2}>{formatLabel(label)}</Text>
                <Text size={0} muted>
                  {uri}
                </Text>
              </Flex>
            </Card>
          );
        }}
        filterOption={(query, opt) => {
          const searchQuery = query.toLowerCase();
          const labelMatch = opt.label.toLowerCase().includes(searchQuery);
          const uriMatch = Boolean(opt.uri?.toLowerCase().includes(searchQuery));
          return labelMatch || uriMatch;
        }}
      />
      {value?.link?._ref ? (
        <AsyncAutocomplete
          placeholder="Select section"
          defaultValue={value?.sectionTarget}
          listItems={fetchSections}
          onChange={(value) => {
            const next = value ? set(value, ["sectionTarget"]) : unset(["sectionTarget"]);

            return onChange(next);
          }}
          renderValue={(value, opt) => {
            return opt?.label ? formatLabel(opt.label) : value;
          }}
          renderOption={({ label }) => {
            return (
              <Card as="button">
                <Box flex={1} padding={3}>
                  <Text size={2}>{formatLabel(label ?? "")}</Text>
                </Box>
              </Card>
            );
          }}
        />
      ) : null}
    </Flex>
  );
}

function createLinkField({
  group,
  noCustomText,
  components,
  options,
  icon = () => <>🔗</>,
  name = "appLink",
  title = "Link",
  description = "Link to an internal page, external URL and more.",
  hidden,
  validation: externalValidation,
}: {
  name?: string;
  title?: string;
  group?: string;
  options?: ObjectOptions;
  description?: string;
  noCustomText?: boolean;
  icon?: React.ComponentType | React.ReactNode;
  components?: ObjectComponents;
  hidden?: (props: { parent: { [key: string]: unknown } }) => boolean;
  validation?: (R: Rule) => unknown;
} = {}) {
  return defineField({
    type: "object",
    name,
    title,
    description,
    group,
    icon,
    hidden,
    validation: externalValidation
      ? (R) => composeValidation(requireTypeWhenObjectHasValue("Select a link type.", hidden), externalValidation)(R as Rule)
      : undefined,
    options: {
      collapsed: false,
      collapsible: true,
      ...options,
    },
    components: {
      input: (props) => <ClearableObjectInput {...props} />,
      ...components,
    },
    fields: [
      defineField({
        name: "type",
        type: "string",
        title: "Link Type",
        description: "Select the type of link.",
        options: {
          layout: "radio",
          direction: "horizontal",
          list: [
            { title: "📄 Internal Link", value: "internal" },
            { title: "🌍 External Link", value: "external" },
            { title: "📧 Email", value: "email" },
            { title: "☎️ Phone", value: "phone" },
            { title: "📃 File", value: "file" },
            { title: "🎛️ URL Params", value: "params" },
          ],
        },
      }),
      defineField({
        name: "external",
        type: "url",
        title: "External Link",
        ...visibleIfType("external"),
        ...requiredIfType("external"),
      }),
      defineField({
        name: "email",
        type: "string",
        title: "Email",
        ...visibleIfType("email"),
        ...requiredIfType("email"),
      }),
      defineField({
        name: "phone",
        type: "string",
        title: "Phone",
        ...visibleIfType("phone"),
        ...requiredIfType("phone"),
      }),
      defineField({
        name: "file",
        type: "file",
        title: "File",
        ...visibleIfType("file"),
        ...requiredIfType("file"),
      }),
      defineField({
        name: "canDownload",
        type: "boolean",
        title: "Downloadable",
        initialValue: true,
        description: "The file will be downloaded when the link is clicked.",
        options: { layout: "switch" },
        ...visibleIfType("file"),
        ...requiredIfType("file"),
      }),
      defineField({
        name: "paramsHref",
        type: "string",
        title: "URL With Params",
        description:
          "Use relative URLs like ?modal=contact or /about?modal=contact. This is ideal for URL-driven modals and UI state.",
        initialValue: "?modal=contact",
        ...visibleIfType("params"),
        ...requiredIfType("params"),
      }),
      defineField({
        name: "internal",
        type: "object",
        title: "Internal Link",
        description: "Select a page and an optional section target.",
        ...visibleIfType("internal"),
        ...requiredIfType("internal"),
        options: {
          collapsed: false,
          collapsible: false,
        },
        components: {
          input: InternalLinkInput,
        },
        fields: [
          defineField({
            type: "reference",
            weak: true,
            name: "link",
            title: "Page",
            validation: (R) => R.required(),
            // Every routed document type: the picker above lists anything with a URI, so the
            // reference has to accept the same set or the Studio flags a valid link as invalid.
            to: [{ type: "page" }, { type: "legalPage" }, { type: "article" }, { type: "blog" }],
          }),
          defineField({
            type: "string",
            name: "sectionTarget",
            title: "Section Target",
          }),
        ],
      }),
      ...(!noCustomText
        ? [
            defineField({
              name: "customText",
              type: "string",
              title: "Custom text",
              description: "Will take precedence over inferred text.",
            }),
          ]
        : []),
      defineField({
        name: "openInNewTab",
        type: "boolean",
        title: "Open in new tab",
        description: "Open the link in a new tab.",
        initialValue: false,
        options: { layout: "switch" },
        ...visibleIfType(["external", "internal"]),
      }),
    ],
    preview: {
      select: {
        type: "type",
        email: "email",
        phone: "phone",
        customText: "customText",
        fileName: "file.asset.originalFilename",
        externalUrl: "external",
        internalUri: "internal.uri.current",
        internalTitle: "internal.title",
        paramsHref: "paramsHref",
      },
      prepare: (props) => {
        return buildLinkPreview(props);
      },
    },
  });
}

export { buildLinkPreview, createLinkField };

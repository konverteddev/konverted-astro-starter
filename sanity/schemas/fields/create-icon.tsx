import { Card, Flex, Text } from "@sanity/ui";
import * as changeCase from "change-case";
import type * as React from "react";
import type { StringInputProps, StringRule, ValidationBuilder } from "sanity";
import { defineField, PatchEvent, set, unset } from "sanity";
import { AsyncAutocomplete } from "../../inputs/async-autocomplete";
import { selectByName } from "../../utils";

/**
 * Component that renders a single icon by name. The caller injects it so this folder stays
 * independent of any specific icon library (see docs/sanity/standalone-folder.md).
 */
type IconComponent<TName extends string> = React.ComponentType<{ name: TName; style?: React.CSSProperties }>;

type IconOption<TName extends string> = {
  value: TName;
  label: string;
};

function getIconOptions<TName extends string>({
  iconNames,
  whitelist,
  blacklist,
}: {
  iconNames: readonly TName[];
  whitelist?: TName[];
  blacklist?: TName[];
}): IconOption<TName>[] {
  return selectByName(iconNames, (name) => name, { whitelist, blacklist, label: "createIconField" })
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({
      value: name,
      label: changeCase.capitalCase(name),
    }));
}

function IconInput<TName extends string>({
  onChange,
  value,
  iconComponent: Icon,
  iconOptions,
}: StringInputProps & { iconComponent: IconComponent<TName>; iconOptions: IconOption<TName>[] }) {
  return (
    <AsyncAutocomplete
      placeholder="Select icon"
      defaultValue={value as TName | undefined}
      listItems={iconOptions}
      onChange={(nextValue) => {
        const next = nextValue ? set(nextValue) : unset();
        onChange(PatchEvent.from(next));
      }}
      renderValue={(value, option) => {
        return option?.label ? option.label : value;
      }}
      renderOption={({ value, label }) => {
        return (
          <Card as="button">
            <Flex align="center" gap={3} padding={3}>
              <Icon name={value} style={{ width: 16, height: 16 }} />
              <Text size={2}>{label}</Text>
            </Flex>
          </Card>
        );
      }}
      renderSelected={(value) => {
        return <Icon name={value} style={{ width: 16, height: 16 }} />;
      }}
    />
  );
}

/** The icon library is injected, so this factory has no dependency on any specific icon set. */
export function createIconField<TName extends string>({
  iconComponent,
  iconNames,
  group,
  whitelist,
  blacklist,
  description = "Select an icon from the icon library.",
  name = "appIcon",
  title = "Icon",
  hidden,
  validation,
}: {
  iconComponent: IconComponent<TName>;
  iconNames: readonly TName[];
  name?: string;
  title?: string;
  group?: string;
  description?: string;
  whitelist?: TName[];
  blacklist?: TName[];
  hidden?: (props: { parent: { [key: string]: unknown } }) => boolean;
  validation?: ValidationBuilder<StringRule, string>;
}) {
  const iconOptions = getIconOptions({ iconNames, whitelist, blacklist });

  return defineField({
    name,
    title,
    description,
    group,
    type: "string",
    hidden,
    validation,
    components: {
      input: (props) => <IconInput {...props} iconComponent={iconComponent} iconOptions={iconOptions} />,
    },
  });
}

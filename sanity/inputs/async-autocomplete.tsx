import { Box, Flex, Text } from "@sanity/ui";
import { Autocomplete } from "@sanity/ui/autocomplete";
import * as React from "react";

type ListItem = {
  value: string;
  label?: string;
  // All other options the user might want to pass in
  // to use in renderOption or renderValue.
  [key: string]: unknown;
};

export const AsyncAutocomplete = <List extends ListItem[]>({
  icon,
  placeholder,
  onChange,
  defaultValue,
  renderValue,
  renderOption,
  renderSelected,
  listItems: initialListItems,
  filterOption,
}: {
  icon?: React.ReactNode;
  placeholder?: string;
  defaultValue?: List[number]["value"];
  listItems: List | Promise<List> | (() => List | Promise<List>);
  onChange?: (value: List[number]["value"]) => void;
  renderSelected?: (value: List[number]["value"]) => React.ReactNode;
  renderOption?: (option: List[number]) => React.JSX.Element;
  renderValue?: (value: List[number]["value"], option?: List[number]) => string;
  filterOption?: (query: string, option: List[number]) => boolean;
}) => {
  const listUid = React.useId();

  const [listItems, setListItems] = React.useState<List>();
  const [isFetching, setIsFetching] = React.useState(false);

  React.useEffect(() => {
    async function fetchList() {
      if (typeof initialListItems === "function") {
        return await initialListItems();
      }

      return initialListItems;
    }

    setIsFetching(true);
    fetchList()
      .then(setListItems)
      .finally(() => setIsFetching(false));
  }, [initialListItems]);

  if (!listItems?.length) {
    return (
      <Text accent size={1}>
        No options available.
      </Text>
    );
  }

  return (
    <Flex align="center" gap={2}>
      {defaultValue && renderSelected ? renderSelected(defaultValue) : null}
      <Box flex={1}>
        <Autocomplete
          openButton
          fontSize={2}
          icon={icon}
          id={`autocomplete-${listUid}`}
          style={{ width: "100%" }}
          loading={isFetching}
          value={defaultValue}
          options={listItems}
          placeholder={placeholder}
          onChange={onChange}
          renderOption={renderOption}
          renderValue={renderValue}
          filterOption={
            filterOption ??
            ((query, opt) => {
              const searchQuery = query.toLowerCase();
              return opt.value.toLowerCase().includes(searchQuery) || Boolean(opt.label?.toLowerCase().includes(searchQuery));
            })
          }
        />
      </Box>
    </Flex>
  );
};

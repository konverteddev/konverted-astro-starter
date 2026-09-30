import { Flex } from "@sanity/ui";
import * as React from "react";
import type { ObjectInputProps } from "sanity";
import { unset } from "sanity";

type ClearableObjectInputProps = ObjectInputProps;

function ClearableObjectInput(props: ClearableObjectInputProps) {
  const previousTypeRef = React.useRef<string | undefined>(undefined);

  React.useEffect(() => {
    const value = props.value as { type?: string } | undefined;
    const currentType = value?.type;

    // If a previously selected type gets cleared from the radio input,
    // unset the whole object to avoid stale nested data/validation.
    if (!currentType && previousTypeRef.current) {
      props.onChange(unset());
    }

    previousTypeRef.current = currentType;
  }, [props.value, props.onChange]);

  return (
    <Flex direction="column" gap={2}>
      {props.renderDefault(props)}
    </Flex>
  );
}

export { ClearableObjectInput };

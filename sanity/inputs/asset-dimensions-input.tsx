import { Box, Button, Flex, Text } from "@sanity/ui";
import * as React from "react";
import { type FileInputProps, useClient, useFormValue } from "sanity";
import { sanityConfig } from "../config";
import { parseLottieAssetDimensionsFromBuffer } from "../lib/parse-lottie-dimensions";
import { parseRiveAssetDimensionsFromBuffer } from "../lib/parse-rive-dimensions";
import { toPatchPath } from "../lib/patch-path";

type AssetDimensions = { width: number; height: number };

type AssetDimensionsInputConfig = {
  /** Human label used in messages, e.g. "Lottie". */
  label: string;
  /** Sibling object field that stores the detected dimensions. */
  dimensionsFieldName: string;
  parse: (buffer: ArrayBuffer) => AssetDimensions | null | Promise<AssetDimensions | null>;
  /** Error shown when the file parses but no dimensions can be read. */
  noDimensionsMessage: string;
};

function createAssetDimensionsInput({ label, dimensionsFieldName, parse, noDimensionsMessage }: AssetDimensionsInputConfig) {
  function AssetDimensionsInput(props: FileInputProps) {
    const { onChange, path, value, renderDefault } = props;
    const client = useClient({ apiVersion: sanityConfig.apiVersion });
    const [status, setStatus] = React.useState<"idle" | "loading" | "ok" | "error">("idle");
    const [message, setMessage] = React.useState<string | null>(null);

    const parentPath = React.useMemo(() => path.slice(0, -1), [path]);
    const dimensionsPath = React.useMemo(() => parentPath.concat(dimensionsFieldName), [parentPath]);
    const dimensionsPatchPath = React.useMemo(() => toPatchPath(dimensionsPath), [dimensionsPath]);

    const dimensions = useFormValue(dimensionsPath);
    const dimensionsRef = React.useRef<unknown>(dimensions);
    dimensionsRef.current = dimensions;
    const documentId = useFormValue(["_id"]);

    const ref = value && typeof value === "object" && "asset" in value ? value.asset?._ref : undefined;
    const previousRef = React.useRef<string | undefined>(undefined);

    const unsetDimensionsIfPresent = React.useCallback(async () => {
      if (dimensionsRef.current == null) {
        return;
      }

      if (!documentId || typeof documentId !== "string") {
        return;
      }

      try {
        await client.patch(documentId).unset([dimensionsPatchPath]).commit({ autoGenerateArrayKeys: false });
      } catch {
        // Field already absent or draft path changed; ignore.
      }
    }, [client, documentId, dimensionsPatchPath]);

    React.useEffect(() => {
      const previous = previousRef.current;

      if (previous && previous !== ref) {
        // Clear stale dimensions whenever editors switch to another uploaded asset.
        void unsetDimensionsIfPresent();
      }

      if (!ref) {
        setStatus("idle");
        setMessage(null);
        previousRef.current = undefined;
        return;
      }

      if (previous !== ref) {
        setStatus("idle");
        setMessage("Click Generate to detect dimensions.");
      }

      previousRef.current = ref;
    }, [ref, unsetDimensionsIfPresent]);

    const readDimensions = React.useCallback(async () => {
      if (!ref) {
        setStatus("error");
        setMessage(`Upload a ${label} file first.`);
        return;
      }

      if (!documentId || typeof documentId !== "string") {
        setStatus("error");
        setMessage("Could not resolve document id for patching.");
        return;
      }

      setStatus("loading");
      setMessage(null);

      try {
        const url = await client.fetch<string | null>(`*[_id == $id][0].url`, { id: ref });

        if (!url) {
          throw new Error("File URL not available");
        }

        const cacheBustedUrl = `${url}${url.includes("?") ? "&" : "?"}assetRef=${encodeURIComponent(ref)}`;
        const res = await fetch(cacheBustedUrl, { cache: "no-store" });

        if (!res.ok) {
          throw new Error("Could not read file");
        }

        const buffer = await res.arrayBuffer();
        const dim = await parse(buffer);

        if (!dim) {
          throw new Error(noDimensionsMessage);
        }

        await client
          .patch(documentId)
          .set({ [dimensionsPatchPath]: dim })
          .commit({ autoGenerateArrayKeys: false });
        setStatus("ok");
        setMessage(`Generated: ${dim.width}×${dim.height}`);
      } catch (e) {
        setStatus("error");
        setMessage(e instanceof Error ? e.message : `Invalid ${label} file`);
      }
    }, [ref, client, documentId, dimensionsPatchPath]);

    return (
      <Box>
        {renderDefault({ ...props, onChange })}

        <Flex gap={2} style={{ marginTop: 8 }}>
          <Button
            text="Generate"
            mode="ghost"
            tone="primary"
            onClick={readDimensions}
            disabled={!ref || status === "loading"}
            loading={status === "loading"}
          />
        </Flex>

        {status === "loading" && (
          <Text muted size={1} style={{ marginTop: 8 }}>
            Reading {label} dimensions…
          </Text>
        )}

        {status === "ok" && message && (
          <Text size={1} style={{ marginTop: 8 }}>
            Dimensions: {message}
          </Text>
        )}

        {status === "error" && message && (
          <Text size={1} style={{ marginTop: 8 }}>
            {message}
          </Text>
        )}
      </Box>
    );
  }

  AssetDimensionsInput.displayName = `${label}FileInput`;

  return AssetDimensionsInput;
}

const LottieFileInput = createAssetDimensionsInput({
  label: "Lottie",
  dimensionsFieldName: "lottieDimensions",
  parse: parseLottieAssetDimensionsFromBuffer,
  noDimensionsMessage:
    "Could not read width/height from Bodymovin JSON. Use a .json file for Generate, or enter dimensions manually for .lottie.",
});

const RiveFileInput = createAssetDimensionsInput({
  label: "Rive",
  dimensionsFieldName: "riveDimensions",
  parse: parseRiveAssetDimensionsFromBuffer,
  noDimensionsMessage: "Could not read width/height from this .riv file.",
});

export { LottieFileInput, RiveFileInput };

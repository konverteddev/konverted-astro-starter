import { Box, Button, Flex, Text } from "@sanity/ui";
import * as React from "react";
import { type FileInputProps, getPublishedId, useClient, useDocumentOperation, useFormValue } from "sanity";
import { sanityConfig } from "../config";
import { captureVideoFrame } from "../lib/capture-video-frame";
import { toPatchPath } from "../lib/patch-path";

const COVER_FIELD_NAME = "videoCover";

/** `clip.mp4` becomes `clip-poster.webp`, so the cover sorts next to its video in the media browser. */
function toPosterFilename(videoFilename: string | undefined, mimeType: string) {
  const base = videoFilename?.replace(/\.[^./]+$/, "").trim();
  const extension = mimeType.split("/")[1] || "webp";

  return `${base || "video"}-poster.${extension}`;
}

/** Video file input that fills the sibling cover with the video's first frame, grabbed in the browser. */
function VideoPosterInput(props: FileInputProps) {
  const { path, value, renderDefault } = props;
  const client = useClient({ apiVersion: sanityConfig.apiVersion });
  const [status, setStatus] = React.useState<"idle" | "loading" | "ok" | "error">("idle");
  const [message, setMessage] = React.useState<string | null>(null);

  const parentPath = React.useMemo(() => path.slice(0, -1), [path]);
  const coverPath = React.useMemo(() => parentPath.concat(COVER_FIELD_NAME), [parentPath]);
  const coverPatchPath = React.useMemo(() => toPatchPath(coverPath), [coverPath]);

  const cover = useFormValue(coverPath);

  const documentId = useFormValue(["_id"]);
  const documentType = useFormValue(["_type"]);
  // Document operations patch the draft, so the cover follows the editor's normal publish flow.
  const { patch } = useDocumentOperation(
    typeof documentId === "string" ? getPublishedId(documentId) : "",
    typeof documentType === "string" ? documentType : ""
  );

  const ref = value && typeof value === "object" && "asset" in value ? value.asset?._ref : undefined;

  const generate = React.useCallback(async () => {
    if (!ref) {
      setStatus("error");
      setMessage("Upload a video file first.");
      return;
    }

    if (typeof documentId !== "string" || typeof documentType !== "string") {
      setStatus("error");
      setMessage("Could not resolve the document to patch.");
      return;
    }

    setStatus("loading");
    setMessage(null);

    try {
      const video = await client.fetch<{ url?: string; originalFilename?: string } | null>(
        `*[_id == $id][0]{url, originalFilename}`,
        { id: ref }
      );

      if (!video?.url) {
        throw new Error("File URL not available");
      }

      const frame = await captureVideoFrame(video.url);
      const asset = await client.assets.upload("image", frame, {
        filename: toPosterFilename(video.originalFilename, frame.type),
      });

      patch.execute([{ set: { [coverPatchPath]: { _type: "image", asset: { _type: "reference", _ref: asset._id } } } }]);

      setStatus("ok");
      setMessage("Cover generated from the first frame.");
    } catch (e) {
      setStatus("error");
      setMessage(e instanceof Error ? e.message : "Could not generate a cover.");
    }
  }, [ref, client, documentId, documentType, patch, coverPatchPath]);

  const previousRef = React.useRef<string | undefined>(undefined);

  React.useEffect(() => {
    if (!ref) {
      setStatus("idle");
      setMessage(null);
      previousRef.current = undefined;
      return;
    }

    if (previousRef.current !== ref) {
      setStatus("idle");
      setMessage("Click Generate to capture the first frame.");
    }

    previousRef.current = ref;
  }, [ref]);

  return (
    <Box>
      {renderDefault(props)}

      <Flex gap={2} style={{ marginTop: 8 }}>
        <Button
          text={cover ? "Replace cover with first frame" : "Generate cover from first frame"}
          mode="ghost"
          tone="primary"
          onClick={generate}
          disabled={!ref || status === "loading"}
          loading={status === "loading"}
        />
      </Flex>

      {status === "loading" && (
        <Text muted size={1} style={{ marginTop: 8 }}>
          Reading the first frame…
        </Text>
      )}

      {status !== "loading" && message && (
        <Text muted={status === "ok"} size={1} style={{ marginTop: 8 }}>
          {message}
        </Text>
      )}
    </Box>
  );
}

VideoPosterInput.displayName = "VideoPosterInput";

export { VideoPosterInput };

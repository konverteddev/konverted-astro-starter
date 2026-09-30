import { Button, Card, Flex, Stack, Text } from "@sanity/ui";
import * as React from "react";
import { type ImageValue, type ObjectInputProps, set, useFormValue } from "sanity";
import { sanityConfig } from "../config";
import { useStudioFetch } from "../lib/studio-fetch";

type ScreenshotResponse = {
  image?: ImageValue;
  error?: string;
};

function SeoImageInput(props: ObjectInputProps<ImageValue>) {
  const studioFetch = useStudioFetch();
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  const sourceUrlRaw = useFormValue(["seoMetadata", "sourceUrl"]);
  const sourceUrl = typeof sourceUrlRaw === "string" ? sourceUrlRaw.trim() : "";

  const waitRaw = useFormValue(["seoMetadata", "screenshotWaitSeconds"]);
  const waitSeconds = typeof waitRaw === "number" && Number.isFinite(waitRaw) ? waitRaw : 2;

  const handleGenerate = async () => {
    if (!sourceUrl) {
      setError("Add a Source URL first.");
      setSuccess(null);
      return;
    }

    setIsGenerating(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await studioFetch(sanityConfig.endpoints.seoScreenshot, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: sourceUrl, waitSeconds }),
      });

      const payload = (await res.json()) as ScreenshotResponse;

      if (!res.ok || !payload.image) {
        throw new Error(payload.error || "Screenshot generation failed.");
      }

      props.onChange(set(payload.image));
      setSuccess("Share image generated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Stack gap={3}>
      {props.renderDefault(props)}

      <Card border padding={3} radius={2} tone="transparent">
        <Stack gap={3}>
          <Stack gap={2}>
            <Text size={1} weight="medium">
              Auto-generate from Source URL
            </Text>
            <Text size={1} muted>
              Captures a 1920×1008 screenshot via Microlink and stores it as the share image.
            </Text>
          </Stack>

          <Flex align="center" gap={2}>
            <Button
              text={isGenerating ? "Generating..." : "Generate"}
              tone="primary"
              disabled={!sourceUrl || isGenerating}
              onClick={handleGenerate}
            />
            {!sourceUrl ? (
              <Text size={1} muted>
                Add a Source URL above to enable.
              </Text>
            ) : null}
          </Flex>

          {isGenerating ? (
            <Card border padding={3} radius={2} tone="primary">
              <Text size={1}>Capturing screenshot — this can take ~10s.</Text>
            </Card>
          ) : null}

          {error ? (
            <Card border padding={3} radius={2} tone="critical">
              <Text size={1}>{error}</Text>
            </Card>
          ) : null}

          {success ? (
            <Card border padding={3} radius={2} tone="positive">
              <Text size={1}>{success}</Text>
            </Card>
          ) : null}
        </Stack>
      </Card>
    </Stack>
  );
}

export { SeoImageInput };

import { Button, Card, Flex, Spinner, Stack, Text } from "@sanity/ui";
import { useToast } from "@sanity/ui/toast";
import * as React from "react";
import type { ObjectInputProps } from "sanity";
import { sanityConfig } from "../config";
import { useStudioFetch } from "../lib/studio-fetch";

type Stats = {
  total: number;
  missing: number;
};

type BatchResult = {
  results?: { _id: string; status: string; reason?: string }[];
  described?: number;
  remaining?: number;
  error?: string;
};

/**
 * The automatic alt text fields plus a backfill panel. Backfilling runs a batch per request and loops,
 * because each image is a round trip and one request would outlive the route's time budget.
 */
function AltTextInput(props: ObjectInputProps) {
  const studioFetch = useStudioFetch();
  const toast = useToast();

  const [stats, setStats] = React.useState<Stats | null>(null);
  const [isRunning, setIsRunning] = React.useState(false);
  const [progress, setProgress] = React.useState<string | null>(null);
  const stopRequested = React.useRef(false);

  const loadStats = React.useCallback(async () => {
    try {
      const res = await studioFetch(sanityConfig.endpoints.imageAltText);
      const payload = (await res.json()) as Stats & { error?: string };

      if (!res.ok) {
        throw new Error(payload.error || "Could not read the image library.");
      }

      setStats({ total: payload.total, missing: payload.missing });
    } catch {
      setStats(null);
    }
  }, [studioFetch]);

  React.useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const runBackfill = async () => {
    stopRequested.current = false;
    setIsRunning(true);
    setProgress("Starting...");

    let described = 0;

    try {
      while (!stopRequested.current) {
        const res = await studioFetch(sanityConfig.endpoints.imageAltText, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ backfill: true }),
        });

        const payload = (await res.json()) as BatchResult;

        if (!res.ok) {
          throw new Error(payload.error || "Backfill failed.");
        }

        const failed = payload.results?.find((result) => result.status === "failed");

        if (failed) {
          throw new Error(failed.reason || "Sanity AI could not describe an image.");
        }

        const batchDescribed = payload.described ?? 0;

        described += batchDescribed;
        setProgress(`Described ${described}, ${payload.remaining ?? 0} to go.`);

        // Stop on a batch that described nothing: what is left was skipped, so asking again would spin forever.
        if (!payload.remaining || !payload.results?.length || batchDescribed === 0) {
          break;
        }
      }

      toast.push({
        status: "success",
        title: stopRequested.current ? "Backfill stopped" : "Backfill complete",
        description: `${described} image${described === 1 ? "" : "s"} described. Open the media browser to review them.`,
      });
    } catch (err) {
      toast.push({
        status: "error",
        title: "Backfill failed",
        description: err instanceof Error ? err.message : "Unknown error.",
      });
    } finally {
      setIsRunning(false);
      setProgress(null);
      void loadStats();
    }
  };

  const missing = stats?.missing ?? 0;

  let buttonLabel = missing > 0 ? `Backfill ${missing} image${missing === 1 ? "" : "s"}` : "Nothing to backfill";

  if (isRunning) {
    buttonLabel = "Backfilling...";
  }

  return (
    <Stack gap={3}>
      {props.renderDefault(props)}

      <Card border padding={3} radius={2} tone="transparent">
        <Stack gap={3}>
          <Stack gap={2}>
            <Text size={1} weight="medium">
              Backfill existing images
            </Text>
            <Text size={1} muted>
              Describes every image in the library that has no alternative text yet and writes it to the asset, so all documents
              using that image pick it up. Existing alt text is never overwritten. Runs regardless of the toggle above.
            </Text>
          </Stack>

          <Flex align="center" gap={3}>
            <Button text={buttonLabel} tone="primary" disabled={isRunning || missing === 0} onClick={() => void runBackfill()} />

            {isRunning ? (
              <Button
                text="Stop"
                mode="ghost"
                onClick={() => {
                  stopRequested.current = true;
                }}
              />
            ) : null}

            {isRunning ? (
              <Flex align="center" gap={2}>
                <Spinner muted />
                <Text size={1} muted>
                  {progress}
                </Text>
              </Flex>
            ) : null}

            {!isRunning && stats ? (
              <Text size={1} muted>
                {missing} of {stats.total} images without alt text.
              </Text>
            ) : null}
          </Flex>
        </Stack>
      </Card>
    </Stack>
  );
}

export { AltTextInput };

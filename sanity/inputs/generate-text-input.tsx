import { Box, Button, Card, Dialog, Flex, Spinner, Stack, Text } from "@sanity/ui";
import { useToast } from "@sanity/ui/toast";
import * as React from "react";
import { type StringInputProps, set, useFormValue } from "sanity";
import { sanityConfig } from "../config";
import { useStudioFetch } from "../lib/studio-fetch";

type GenerateResponse = {
  text?: string;
  error?: string;
};

type GenerateTextInputConfig = {
  /** Same-origin API route that returns `{ text }`. */
  endpoint: string;
  /** Form path of the sibling value sent along with the request. */
  contextPath: Array<string>;
  /** Request body key for the context value. */
  contextBodyKey: string;
  /** When true, the Generate button is disabled until the context value is set. */
  requireContext?: boolean;
  copy: {
    cardTitle: string;
    cardDescription: string;
    spinnerText: string;
    /** Shown next to the button; with `requireContext` when the context is missing, otherwise when it is present. */
    contextHint: string;
    successTitle: string;
    successDescription: string;
    dialogId: string;
    dialogHeader: string;
    dialogBody: string;
  };
};

/** String input with a Generate button. Overwriting confirms via a Sanity `Dialog`, never `window.confirm`. */
function createGenerateTextInput({ endpoint, contextPath, contextBodyKey, requireContext, copy }: GenerateTextInputConfig) {
  function GenerateTextInput(props: StringInputProps) {
    const studioFetch = useStudioFetch();
    const { value, onChange } = props;
    const toast = useToast();

    const [isGenerating, setIsGenerating] = React.useState(false);
    const [showOverwriteConfirm, setShowOverwriteConfirm] = React.useState(false);

    const contextRaw = useFormValue(contextPath);
    const context = typeof contextRaw === "string" ? contextRaw.trim() : "";

    const runGenerate = async () => {
      setIsGenerating(true);

      try {
        const res = await studioFetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [contextBodyKey]: context }),
        });

        const payload = (await res.json()) as GenerateResponse;

        if (!res.ok || !payload.text) {
          throw new Error(payload.error || "Generation failed.");
        }

        onChange(set(payload.text));
        toast.push({
          status: "success",
          title: copy.successTitle,
          description: copy.successDescription,
        });
      } catch (err) {
        toast.push({
          status: "error",
          title: "Generation failed",
          description: err instanceof Error ? err.message : "Unknown error.",
        });
      } finally {
        setIsGenerating(false);
      }
    };

    const handleGenerateClick = () => {
      const hasExistingContent = typeof value === "string" && value.trim().length > 0;

      if (hasExistingContent) {
        setShowOverwriteConfirm(true);
        return;
      }

      void runGenerate();
    };

    const confirmOverwrite = () => {
      setShowOverwriteConfirm(false);
      void runGenerate();
    };

    const showContextHint = requireContext ? !context : Boolean(context);

    return (
      <Stack gap={3}>
        <Card border padding={3} radius={2} tone="transparent">
          <Stack gap={3}>
            <Stack gap={2}>
              <Text size={1} weight="medium">
                {copy.cardTitle}
              </Text>
              <Text size={1} muted>
                {copy.cardDescription}
              </Text>
            </Stack>

            <Flex align="center" gap={3}>
              <Button
                text={isGenerating ? "Generating..." : "Generate"}
                tone="primary"
                disabled={isGenerating || (requireContext ? !context : false)}
                onClick={handleGenerateClick}
              />

              {isGenerating ? (
                <Flex align="center" gap={2}>
                  <Spinner muted />
                  <Text size={1} muted>
                    {copy.spinnerText}
                  </Text>
                </Flex>
              ) : null}

              {!isGenerating && showContextHint ? (
                <Text size={1} muted>
                  {copy.contextHint}
                </Text>
              ) : null}
            </Flex>
          </Stack>
        </Card>

        {props.renderDefault(props)}

        {showOverwriteConfirm ? (
          <Dialog
            id={copy.dialogId}
            header={copy.dialogHeader}
            width={1}
            onClose={() => setShowOverwriteConfirm(false)}
            footer={
              <Flex gap={2} justify="flex-end" padding={2}>
                <Button text="Cancel" mode="ghost" onClick={() => setShowOverwriteConfirm(false)} />
                <Button text="Replace and generate" tone="critical" onClick={confirmOverwrite} />
              </Flex>
            }
          >
            <Box padding={4}>
              <Text size={1}>{copy.dialogBody}</Text>
            </Box>
          </Dialog>
        ) : null}
      </Stack>
    );
  }

  return GenerateTextInput;
}

/** Input for the `llms.content` field: drafts a spec-compliant llms.txt via Sanity Agent Actions. */
const LlmsTxtInput = createGenerateTextInput({
  endpoint: sanityConfig.endpoints.generateLlmsTxt,
  contextPath: ["llms", "guidance"],
  contextBodyKey: "guidance",
  copy: {
    cardTitle: "Generate with Sanity AI",
    cardDescription:
      "Drafts an llms.txt from your published pages and articles using Sanity Agent Actions. The result lands in the field below as an editable draft, nothing is served until you publish.",
    spinnerText: "Reading your content and writing the file. This can take a moment.",
    contextHint: "Using your generation guidance.",
    successTitle: "Draft generated",
    successDescription: "Review it, then publish to serve it at /llms.txt.",
    dialogId: "llms-txt-overwrite-confirm",
    dialogHeader: "Replace llms.txt?",
    dialogBody:
      "This replaces the current llms.txt with a freshly generated draft. You can review and edit it before publishing.",
  },
});

/** Input for a page's agent Markdown field: serializes the page's current content. */
const AgentMarkdownInput = createGenerateTextInput({
  endpoint: sanityConfig.endpoints.generatePageMarkdown,
  contextPath: ["uri", "current"],
  contextBodyKey: "uri",
  requireContext: true,
  copy: {
    cardTitle: "Generate from page content",
    cardDescription:
      "Builds a token-light Markdown version of this page from its current content. The result lands in the field below as an editable draft; nothing is served until you publish.",
    spinnerText: "Reading this page and writing the Markdown.",
    contextHint: "Set this page's URL first to enable.",
    successTitle: "Markdown generated",
    successDescription: "Review it, then publish to serve it to agents.",
    dialogId: "agent-markdown-overwrite-confirm",
    dialogHeader: "Replace Markdown?",
    dialogBody:
      "This replaces the current Markdown with a freshly generated draft. You can review and edit it before publishing.",
  },
});

export { AgentMarkdownInput, LlmsTxtInput };

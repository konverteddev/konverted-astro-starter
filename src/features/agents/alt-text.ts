import type { SanityClient } from "@sanity/client";
import { AGENT_SCRATCH_DOCUMENTS, SANITY_AGENT_API_VERSION, SANITY_AGENT_SCHEMA_ID } from "~/sanity/constants";

/** The scratch document and field the description is generated into. See the `imageAltText` schema. */
const SOURCE_DOCUMENT_ID = AGENT_SCRATCH_DOCUMENTS.imageAltText;
const SOURCE_DOCUMENT_TYPE = AGENT_SCRATCH_DOCUMENTS.imageAltText;
const TARGET_PATH = "altText";

/** Catches a runaway response: screen readers announce alt text unpunctuated, so a pasted paragraph is worse than a short line. */
export const MAX_ALT_TEXT_LENGTH = 125;

/** Extensions the pipeline cannot rasterize: an SVG is served verbatim, so the model would get markup. */
const UNDESCRIBABLE_EXTENSIONS = new Set(["svg"]);

const ALT_TEXT_INSTRUCTION = `Write the alternative text for this image. It will be announced by a screen reader in place of the image, on a company website.

Carry the same information the image carries, and nothing else.

RULES
- One line, sentence case, no trailing period. Output only the alt text: no quotes, no label, no explanation.
- Aim for 5 to 15 words. Never exceed ${MAX_ALT_TEXT_LENGTH} characters.
- Lead with the subject. Never open with "Image of", "Photo of", "Picture of", "This image shows", or the file name.
- Name what is visible and what matters: the subject, what it is doing, and only the details that change the meaning.
- When legible text carries the meaning (a headline, a certificate, a UI label), quote that text instead of describing how it looks.
- For a screenshot or interface, say which interface it is and what state it is in.
- Leave out decoration: colour palettes, lighting, mood, composition, camera angle, and any adjective that adds no information.
- No marketing language, no interpretation, no guessing at brands, people, or dates that are not legible in the image.

The original file name is $filename. Use it only to disambiguate what you already see; never quote it and never trust it over the image.

Editor guidance, which overrides the stylistic rules above unless it is "(none)": $guidance`;

/** Openers that restate the medium. The instruction forbids them; this is the safety net. */
const REDUNDANT_OPENERS = [
  /^(?:an?\s+)?(?:image|photo|photograph|picture)\s+(?:of|showing|depicting)\s+/i,
  /^(?:this|the)\s+(?:image|photo|photograph|picture)\s+(?:shows|depicts|displays|features|is)\s+/i,
];

/** Only a matched pair around the whole line: stripping quotes anywhere would eat a description that quotes legible text. */
const QUOTE_PAIRS = [
  ['"', '"'],
  ["'", "'"],
  ["“", "”"],
  ["‘", "’"],
  ["`", "`"],
] as const;

function stripWrappingQuotes(value: string) {
  for (const [open, close] of QUOTE_PAIRS) {
    if (value.length >= open.length + close.length && value.startsWith(open) && value.endsWith(close)) {
      return value.slice(open.length, -close.length).trim();
    }
  }

  return value;
}

export type DescribableAsset = {
  _id: string;
  url?: string;
  extension?: string;
  filename?: string;
};

/** Assets the pipeline can hand to the vision model as a raster image. */
export function isDescribableAsset(asset: Pick<DescribableAsset, "url" | "extension">) {
  if (!asset.url?.startsWith("https://")) {
    return false;
  }

  return !UNDESCRIBABLE_EXTENSIONS.has((asset.extension ?? "").toLowerCase());
}

/** Capped at 1024px and re-encoded to JPEG, so a 3840px PNG does not travel to the model at full weight. */
export function buildDescriptionSourceUrl(assetUrl: string): `https://${string}` {
  const url = new URL(assetUrl);

  url.searchParams.set("w", "1024");
  url.searchParams.set("fit", "max");
  url.searchParams.set("fm", "jpg");
  url.searchParams.set("q", "80");

  return url.toString() as `https://${string}`;
}

/** Cut to the last word boundary rather than mid-word, dropping any punctuation left dangling. */
function truncateAtWord(value: string, max: number) {
  if (value.length <= max) {
    return value;
  }

  const clipped = value.slice(0, max);
  const lastSpace = clipped.lastIndexOf(" ");
  const cut = lastSpace > max * 0.6 ? clipped.slice(0, lastSpace) : clipped;

  return cut.trimEnd().replace(/[,;:.]+$/, "");
}

/** Models add a preamble, quote the answer, or restate the medium; none of that should be announced. */
export function normalizeAltText(raw: string) {
  const firstLine = raw
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  if (!firstLine) {
    return "";
  }

  let value = stripWrappingQuotes(firstLine);

  for (const opener of REDUNDANT_OPENERS) {
    value = value.replace(opener, "");
  }

  value = value.replace(/\s+/g, " ").trim().replace(/[.]+$/, "");

  if (!value) {
    return "";
  }

  return truncateAtWord(value.charAt(0).toUpperCase() + value.slice(1), MAX_ALT_TEXT_LENGTH);
}

/** Runs against the `imageAltText` scratch document with `noWrite`, since Transform needs a schema-aware source. Callers patch the asset. */
export async function generateAltText(
  client: SanityClient,
  props: { imageUrl: `https://${string}`; filename?: string; guidance?: string }
) {
  const { imageUrl, filename, guidance } = props;
  const agentClient = client.withConfig({ apiVersion: SANITY_AGENT_API_VERSION });

  await agentClient.createIfNotExists({ _id: SOURCE_DOCUMENT_ID, _type: SOURCE_DOCUMENT_TYPE });

  const result = await agentClient.agent.action.transform({
    schemaId: SANITY_AGENT_SCHEMA_ID,
    documentId: SOURCE_DOCUMENT_ID,
    noWrite: true,
    instruction: "Describe the target image. Follow the target's own instruction exactly.",
    instructionParams: {
      filename: { type: "constant", value: filename || "(unknown)" },
      guidance: { type: "constant", value: guidance || "(none)" },
    },
    target: {
      path: [TARGET_PATH],
      operation: { type: "image-description", imageUrl },
      instruction: ALT_TEXT_INSTRUCTION,
    },
    temperature: 0.2,
  });

  const described = (result as Record<string, unknown> | undefined)?.[TARGET_PATH];

  return typeof described === "string" ? normalizeAltText(described) : "";
}

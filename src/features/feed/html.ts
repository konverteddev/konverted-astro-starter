// Serializes an article body to reader-safe HTML (pure): readers strip scripts, styles and widgets, so blocks keep meaning only.

import { escapeHTML, type PortableTextHtmlComponents, toHTML } from "@portabletext/to-html";
import { joinSiteUrl } from "~/lib/site-url";

// One loose bag like the agent Markdown serializer's: both read the `frag::agentRichText` projection.
type Block = {
  alt?: string | null;
  imageUrl?: string | null;
  caption?: string | null;
};

const IMAGE_WIDTH = 1200;

function image({ alt, imageUrl }: Block): string {
  if (!imageUrl) {
    return "";
  }

  return `<img src="${escapeHTML(`${imageUrl}?w=${IMAGE_WIDTH}&fit=max&auto=format`)}" alt="${escapeHTML(alt ?? "")}" />`;
}

function figure(body: string, caption?: string | null): string {
  const figcaption = caption ? `<figcaption>${escapeHTML(caption)}</figcaption>` : "";
  return body ? `<figure>${body}${figcaption}</figure>` : "";
}

// An editor's empty line is spacing on the page and an empty tag in a reader.
function paragraph({ children }: { children?: string }): string {
  return children ? `<p>${children}</p>` : "";
}

/** `baseUrl` resolves site-relative hrefs, which mean nothing inside a reader. */
export function richTextToFeedHtml(content: unknown, baseUrl: string): string {
  const absolutize = (href: string) => (href.startsWith("/") ? joinSiteUrl(baseUrl, href) : href);

  // PROJECT seam: a new rich text block needs its fields in `frag::agentRichText` and a renderer here.
  const types: Record<string, (value: Block) => string> = {
    mediaBlock: (value) => figure(image(value), value.caption),
  };

  const components: Partial<PortableTextHtmlComponents> = {
    types: Object.fromEntries(
      Object.entries(types).map(([name, renderType]) => [name, ({ value }: { value: Block }) => renderType(value)])
    ),
    block: {
      normal: paragraph,
      caption: ({ children }) => `<p><em>${children}</em></p>`,
    },
    marks: {
      linkField: ({ children, value }) => {
        const href = (value as { href?: string } | undefined)?.href;
        return href ? `<a href="${escapeHTML(absolutize(href))}">${children}</a>` : children;
      },
      sup: ({ children }) => `<sup>${children}</sup>`,
    },
    // Decorative marks (colour, indent) and blocks without a renderer fall away, keeping their text.
    unknownMark: ({ children }) => children,
    unknownType: () => "",
    unknownBlockStyle: paragraph,
  };

  if (!Array.isArray(content)) {
    return "";
  }

  // biome-ignore lint/suspicious/noExplicitAny: the blocks are a GROQ projection, typed loosely on purpose.
  return toHTML(content.filter(Boolean) as any, { components, onMissingComponent: false });
}

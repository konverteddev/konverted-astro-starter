/** True when the client's `Accept` prefers Markdown over HTML (agents; browsers never list it, so they exit fast). */
export function prefersMarkdown(accept: string | null): boolean {
  if (!accept) {
    return false;
  }

  const lower = accept.toLowerCase();

  if (!lower.includes("markdown")) {
    return false;
  }

  let markdownQ = -1;
  let htmlQ = -1;

  for (const entry of lower.split(",")) {
    const [typeRaw = "", ...paramsRaw] = entry.split(";");
    const type = typeRaw.trim();
    let q = 1;

    for (const param of paramsRaw) {
      const [key, value] = param.split("=");

      if (key?.trim() === "q") {
        const parsed = Number.parseFloat(value ?? "");

        if (!Number.isNaN(parsed)) {
          q = parsed;
        }
      }
    }

    if (type === "text/markdown" || type === "text/x-markdown") {
      markdownQ = Math.max(markdownQ, q);
    } else if (type === "text/html" || type === "application/xhtml+xml") {
      htmlQ = Math.max(htmlQ, q);
    }
  }

  if (markdownQ <= 0) {
    return false;
  }

  return markdownQ >= htmlQ;
}

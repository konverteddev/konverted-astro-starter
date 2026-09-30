/** Turns a form path into the string path `client.patch(...).set()` expects. */
function toPatchPath(path: Array<unknown>) {
  const normalized = path.filter((segment) => !(typeof segment === "string" && segment.length === 0));
  const rooted = normalized[0] === "sectionsArray" ? ["pageBuilder", ...normalized] : normalized;

  return rooted
    .map((segment, index) => {
      if (typeof segment === "string") {
        if (/^[A-Za-z_]\w*$/.test(segment)) {
          return index === 0 ? segment : `.${segment}`;
        }

        return `["${segment.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"]`;
      }

      if (typeof segment === "number") {
        return `[${segment}]`;
      }

      if (
        typeof segment === "object" &&
        segment !== null &&
        "_key" in segment &&
        typeof (segment as { _key?: unknown })._key === "string"
      ) {
        const key = (segment as { _key: string })._key.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
        return `[_key=="${key}"]`;
      }

      return "";
    })
    .join("");
}

export { toPatchPath };

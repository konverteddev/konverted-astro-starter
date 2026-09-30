// The stock @sanity/astro component reloads the window on every Studio edit, and its .astro wrapper
// cannot pass a `refresh` function across the island boundary, so the React component is rendered directly.
import { VisualEditingComponent } from "@sanity/astro/visual-editing/component";
import { reloadInPlace } from "~/lib/transitions/in-place";

export function VisualEditing() {
  return <VisualEditingComponent refresh={reloadInPlace} />;
}

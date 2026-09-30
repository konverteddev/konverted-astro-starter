import { definePreview } from "~/features/page-builder/section-preview";

// The form is wired to an endpoint and renders its own states, so a still of it says nothing useful.
export const preview = definePreview({ skip: "Renders a live form rather than a layout" });
